import os
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from dotenv import load_dotenv
import json

load_dotenv()

router = APIRouter(
    prefix="/app2",
    tags=["summarizer"],
    responses={404: {"description": "Not found"}},
)

model = ChatOpenAI(model="gpt-4o-mini", temperature=0)

prompt = ChatPromptTemplate.from_messages([
    (
        "system",
        "You are an expert summarizer. Summarize the following text concisely, "
        "capturing the most important points. Adapt summary length to input length: "
        "short texts get 2-3 sentences, longer texts get a few paragraphs with key "
        "takeaways. Use clear, professional language."
    ),
    ("human", "{text}"),
])

parser = StrOutputParser()


class QueryRequest(BaseModel):
    text: str


# ── Original non-streaming endpoint (kept for backward compatibility) ──
@router.post("/summarize")
async def summarize(request: QueryRequest):
    chain = prompt | model | parser
    summary = chain.invoke({"text": request.text})
    return {"summary": summary}


# ── New streaming endpoint ──
@router.post("/summarize/stream")
async def summarize_stream(request: QueryRequest):
    chain = prompt | model | parser

    async def event_generator():
        try:
            async for chunk in chain.astream({"text": request.text}):
                # Send each token as an SSE event
                data = json.dumps({"token": chunk})
                yield f"data: {data}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            error_data = json.dumps({"error": str(e)})
            yield f"data: {error_data}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering if behind nginx
        },
    )