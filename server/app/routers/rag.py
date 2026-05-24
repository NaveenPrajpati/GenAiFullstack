import asyncio
import os
import shutil
import tempfile
import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, BackgroundTasks, Form, UploadFile, File, HTTPException
from pydantic import BaseModel
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_community.document_loaders import PyPDFLoader, TextLoader, WebBaseLoader
from dotenv import load_dotenv
import json
from pinecone import Pinecone, ServerlessSpec
from langchain_pinecone import PineconeVectorStore
from langchain_community.retrievers import BM25Retriever
from langchain_classic.retrievers import (
    EnsembleRetriever,
    ContextualCompressionRetriever,
)
from langchain_classic.retrievers.document_compressors import CrossEncoderReranker
from langchain_community.document_transformers import LongContextReorder
from langchain_community.cross_encoders import HuggingFaceCrossEncoder
from langchain_classic.retrievers.multi_query import MultiQueryRetriever
from app.utils.spliters import getSpliter


load_dotenv()

api_key = os.getenv("PINECONE_KEY")
if not api_key:
    raise ValueError("PINECONE_KEY environment variable not set")

pc = Pinecone(api_key=api_key)
index_name = "rag-first"

if not pc.has_index(index_name):
    pc.create_index(
        name=index_name,
        dimension=1536,
        metric="cosine",
        spec=ServerlessSpec(cloud="aws", region="us-east-1"),
    )

index = pc.Index(index_name)

router = APIRouter(
    prefix="/rag",
    tags=["rag"],
    responses={404: {"description": "Not found"}},
)

embeddings = OpenAIEmbeddings()
text_splitter = getSpliter(strategy="recursive", embeddings=None)
vector_store = PineconeVectorStore(embedding=embeddings, index=index)

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
_cross_encoder = HuggingFaceCrossEncoder(model_name="BAAI/bge-reranker-base")
reranker = CrossEncoderReranker(model=_cross_encoder, top_n=5)
reorder = LongContextReorder()

_all_chunks: list = []
sparse_retriever: Optional[BM25Retriever] = None

# Tracks async ingestion jobs: job_id -> status dict
_ingestion_jobs: dict[str, dict] = {}


def _rebuild_sparse_retriever():
    global sparse_retriever
    if _all_chunks:
        sparse_retriever = BM25Retriever.from_documents(_all_chunks)
        sparse_retriever.k = 10


# ── Evaluation helpers ────────────────────────────────────────────────────────


async def _score_doc_relevance(question: str, content: str) -> float:
    """Binary relevance judgment: 1.0 = relevant, 0.0 = not relevant."""
    msg = await llm.ainvoke(
        [
            SystemMessage(
                content=(
                    "You are a relevance judge. Given a query and a document chunk, "
                    "reply only YES if the document helps answer the query, or NO if it does not."
                )
            ),
            HumanMessage(content=f"Query: {question}\n\nDocument: {content[:600]}"),
        ]
    )
    return 1.0 if "YES" in msg.content.upper() else 0.0


async def _score_recall(question: str, context: str) -> float:
    """Approximate recall: how completely does the context cover the question (0–1)."""
    msg = await llm.ainvoke(
        [
            SystemMessage(
                content=(
                    "You are an evaluation assistant. Rate how completely the context "
                    "contains the information needed to fully answer the question. "
                    "0.0 = context is useless, 1.0 = context fully covers the answer. "
                    "Return only a decimal number."
                )
            ),
            HumanMessage(content=f"Question: {question}\n\nContext: {context[:2000]}"),
        ]
    )
    try:
        return round(max(0.0, min(1.0, float(msg.content.strip()))), 3)
    except ValueError:
        return 0.0


async def _score_hallucination(context: str, answer: str) -> float:
    """Hallucination rate: fraction of the answer not supported by context (0=grounded, 1=hallucinated)."""
    msg = await llm.ainvoke(
        [
            SystemMessage(
                content=(
                    "You are a hallucination detector. Rate what fraction of the answer "
                    "contains claims NOT supported by the provided context. "
                    "0.0 = fully grounded, 1.0 = fully hallucinated. Return only a decimal number."
                )
            ),
            HumanMessage(content=f"Context: {context[:2000]}\n\nAnswer: {answer}"),
        ]
    )
    try:
        return round(max(0.0, min(1.0, float(msg.content.strip()))), 3)
    except ValueError:
        return 0.0


async def _run_evaluation(question: str, docs: list, context: str, answer: str) -> dict:
    """Run precision, recall, and hallucination checks in parallel."""
    relevance_tasks = [_score_doc_relevance(question, doc.page_content) for doc in docs]
    results = await asyncio.gather(
        *relevance_tasks,
        _score_recall(question, context),
        _score_hallucination(context, answer),
    )

    relevance_scores = list(results[: len(docs)])
    recall_score = results[-2]
    hallucination_rate = results[-1]
    precision = (
        sum(relevance_scores) / len(relevance_scores) if relevance_scores else 0.0
    )

    return {
        "retrieval_precision": round(precision, 3),
        "recall_score": recall_score,
        "hallucination_rate": hallucination_rate,
    }


# ── Source citation builder ───────────────────────────────────────────────────


def _build_sources(docs: list) -> list[dict]:
    """Return deduplicated source citations with chunk text, page, and confidence score."""
    seen: set = set()
    sources = []
    for doc in docs:
        key = doc.page_content[:120]
        if key in seen:
            continue
        seen.add(key)

        # CrossEncoderReranker writes relevance_score into metadata after reranking
        raw_score = doc.metadata.get("relevance_score")
        sources.append(
            {
                "chunk_text": doc.page_content,
                "source": doc.metadata.get("source", "unknown"),
                "page_number": doc.metadata.get(
                    "page"
                ),  # PyPDFLoader sets "page" (0-indexed)
                "confidence_score": (
                    round(float(raw_score), 4) if raw_score is not None else None
                ),
                "doc_id": doc.metadata.get("doc_id"),
            }
        )
    return sources


# ── Async ingestion background task ──────────────────────────────────────────


async def _run_ingestion(
    job_id: str,
    loader,
    display_source: str,
    file_type: str,
    tmp_path: Optional[str],
):
    try:
        _ingestion_jobs[job_id]["status"] = "processing"

        documents = await asyncio.to_thread(loader.load)
        chunks = await asyncio.to_thread(text_splitter.split_documents, documents)

        ingested_at = datetime.now(timezone.utc).isoformat()
        for i, chunk in enumerate(chunks):
            chunk.metadata.update(
                {
                    "doc_id": job_id,
                    "source": display_source,
                    "file_type": file_type,
                    "ingested_at": ingested_at,
                    "chunk_index": i,
                    "total_chunks": len(chunks),
                }
            )

        await asyncio.to_thread(vector_store.add_documents, chunks)
        _all_chunks.extend(chunks)
        _rebuild_sparse_retriever()

        _ingestion_jobs[job_id].update(
            {
                "status": "completed",
                "chunks": len(chunks),
                "source": display_source,
                "completed_at": datetime.now(timezone.utc).isoformat(),
            }
        )

    except Exception as exc:
        _ingestion_jobs[job_id].update({"status": "failed", "error": str(exc)})

    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)


# ── Routes ────────────────────────────────────────────────────────────────────


@router.post("/ingest/{action}", status_code=202)
async def ingest_document(
    background_tasks: BackgroundTasks,
    action: str,
    data: str = Form(...),
    file: Optional[UploadFile] = File(None),
):
    parsed = json.loads(data)
    tmp_path = None
    job_id = str(uuid.uuid4())

    if action == "url":
        loader = WebBaseLoader(web_path=parsed["url"])
        display_source = parsed["url"]
        file_type = "url"

    else:
        if not file:
            raise HTTPException(status_code=400, detail="File is required")
        if file.content_type not in ["application/pdf", "text/plain"]:
            raise HTTPException(
                status_code=400, detail="Only PDF and text files are supported"
            )

        suffix = ".pdf" if file.content_type == "application/pdf" else ".txt"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            shutil.copyfileobj(file.file, tmp)
            tmp_path = tmp.name

        loader = PyPDFLoader(tmp_path) if suffix == ".pdf" else TextLoader(tmp_path)
        display_source = file.filename
        file_type = "pdf" if suffix == ".pdf" else "text"

    _ingestion_jobs[job_id] = {
        "status": "queued",
        "source": display_source,
        "queued_at": datetime.now(timezone.utc).isoformat(),
    }

    background_tasks.add_task(
        _run_ingestion, job_id, loader, display_source, file_type, tmp_path
    )

    return {"job_id": job_id, "status": "queued", "source": display_source}


@router.get("/ingest/status/{job_id}")
async def ingest_status(job_id: str):
    job = _ingestion_jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


class QueryRequest(BaseModel):
    question: str
    evaluate: bool = False


@router.post("/query")
async def query_documents(request: QueryRequest):
    if sparse_retriever is None:
        return {
            "answer": "No documents ingested yet. Please upload documents first.",
            "sources": [],
        }

    # Step 1 — Dense retriever with MMR for diversity
    dense_retriever = vector_store.as_retriever(
        search_type="mmr",
        search_kwargs={"k": 6, "fetch_k": 20, "lambda_mult": 0.7},
    )

    # Step 2 — Hybrid retrieval: BM25 (lexical) + dense (semantic)
    hybrid_retriever = EnsembleRetriever(
        retrievers=[sparse_retriever, dense_retriever],
        weights=[0.4, 0.6],
    )

    # Step 3 — Multi-query expansion
    multi_query_retriever = MultiQueryRetriever.from_llm(
        retriever=hybrid_retriever,
        llm=llm,
    )

    # Step 4 — Cross-encoder reranking (writes relevance_score into doc.metadata)
    compression_retriever = ContextualCompressionRetriever(
        base_compressor=reranker,
        base_retriever=multi_query_retriever,
    )

    docs = compression_retriever.invoke(request.question)

    if not docs:
        return {
            "answer": "No relevant documents found. Please upload documents first.",
            "sources": [],
        }

    # Step 5 — Long context reorder
    docs = reorder.transform_documents(docs)

    # Step 6 — Generation
    context = "\n\n".join(doc.page_content for doc in docs)

    prompt = ChatPromptTemplate.from_messages(
        [
            (
                "system",
                "You are a helpful assistant. Answer the user's question based only on the provided context. If the context doesn't contain enough information to answer, say so.",
            ),
            ("human", "Context:\n{context}\n\nQuestion: {question}"),
        ]
    )

    response = await (prompt | llm).ainvoke(
        {"context": context, "question": request.question}
    )

    sources = _build_sources(docs)

    result: dict = {"answer": response.content, "sources": sources}

    # Step 7 — Evaluation (opt-in, runs all checks in parallel)
    if request.evaluate:
        result["evaluation"] = await _run_evaluation(
            request.question, docs, context, response.content
        )

    return result
