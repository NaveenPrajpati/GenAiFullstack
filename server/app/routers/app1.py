import os
import shutil
import tempfile
from typing import Optional
from fastapi import APIRouter, Form, Query, UploadFile, File, HTTPException
from pydantic import BaseModel
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_core.prompts import ChatPromptTemplate
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import PyPDFLoader, TextLoader, WebBaseLoader
from langchain_community.vectorstores import InMemoryVectorStore
from dotenv import load_dotenv
from langchain_chroma import Chroma
import json

load_dotenv()

router = APIRouter(
    prefix="/app1",
    tags=["rag"],
    responses={404: {"description": "Not found"}},
)

embeddings = OpenAIEmbeddings()
text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
vectorstore = Chroma(
    collection_name="rag_collection",
    embedding_function=embeddings,
    persist_directory="./chroma_langchain_db",
)


def get_vectorstore():
    return vectorstore


def add_to_vectorstore(chunks):
    vectorstore.add_documents(chunks)


class Body(BaseModel):
    url:str
    type:Optional[str]=None



@router.post("/ingest/{action}")
async def ingest_document(
    action: str,
    data: str = Form(...),
    page: int = Query(1),
    isAdmin: bool = Query(True),
    file: Optional[UploadFile] = File(None),
):
    parsedData = json.loads(data)

    tmp_path = None

    try:
        if action == "url":
            loader = WebBaseLoader(
                web_path=parsedData["url"]
            )

        else:
            if not file:
                raise HTTPException(
                    status_code=400,
                    detail="File is required"
                )

            if file.content_type not in [
                "application/pdf",
                "text/plain",
            ]:
                raise HTTPException(
                    status_code=400,
                    detail="Only PDF and text files are supported",
                )

            suffix = (
                ".pdf"
                if file.content_type == "application/pdf"
                else ".txt"
            )

            with tempfile.NamedTemporaryFile(
                delete=False,
                suffix=suffix
            ) as tmp:
                shutil.copyfileobj(file.file, tmp)
                tmp_path = tmp.name

            loader = (
                PyPDFLoader(tmp_path)
                if suffix == ".pdf"
                else TextLoader(tmp_path)
            )

        documents = loader.load()
        chunks = text_splitter.split_documents(documents)

        add_to_vectorstore(chunks)

        return {
            "success": True,
            "chunks": len(chunks),
            "action": action,
        }

    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)

class QueryRequest(BaseModel):
    question: str


@router.post("/query")
async def query_documents(request: QueryRequest):
    vectorstore = get_vectorstore()

    retriever = vectorstore.as_retriever(search_kwargs={"k": 4,'fetch_k':20},search_type="mmr")
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
