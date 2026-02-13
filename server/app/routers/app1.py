import os
import shutil
import tempfile
from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_core.prompts import ChatPromptTemplate
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import PyPDFLoader, TextLoader
from langchain_community.vectorstores import InMemoryVectorStore
from dotenv import load_dotenv

load_dotenv()

router = APIRouter(
    prefix="/app1",
    tags=["rag"],
    responses={404: {"description": "Not found"}},
)

embeddings = OpenAIEmbeddings()
text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
vectorstore = InMemoryVectorStore(embeddings)


def get_vectorstore():
    return vectorstore


def add_to_vectorstore(chunks):
    vectorstore.add_documents(chunks)


@router.post("/ingest")
async def ingest_document(file: UploadFile = File(...)):
    if file.content_type not in [
        "application/pdf",
        "text/plain",
    ]:
        raise HTTPException(
            status_code=400, detail="Only PDF and text files are supported"
        )

    suffix = ".pdf" if file.content_type == "application/pdf" else ".txt"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name

    try:
        if suffix == ".pdf":
            loader = PyPDFLoader(tmp_path)
        else:
            loader = TextLoader(tmp_path)

        documents = loader.load()
        chunks = text_splitter.split_documents(documents)

        add_to_vectorstore(chunks)

        return {"message": f"Ingested {len(chunks)} chunks from '{file.filename}'"}
    finally:
        os.unlink(tmp_path)


class QueryRequest(BaseModel):
    question: str


@router.post("/query")
async def query_documents(request: QueryRequest):
    vectorstore = get_vectorstore()

    retriever = vectorstore.as_retriever(search_kwargs={"k": 4})
    docs = retriever.invoke(request.question)

    if not docs:
        return {
            "answer": "No relevant documents found. Please upload documents first.",
            "sources": [],
        }

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

    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
    chain = prompt | llm

    response = chain.invoke({"context": context, "question": request.question})

    sources = list({doc.metadata.get("source", "unknown") for doc in docs})

    return {
        "answer": response.content,
        "sources": sources,
    }
