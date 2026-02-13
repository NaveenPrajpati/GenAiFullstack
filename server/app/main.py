from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
import os
from dotenv import load_dotenv
from .routers import users, app1
from .dependencies import get_query_token, get_token_header

load_dotenv()

app = FastAPI()

origins = [
    "http://localhost:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(prefix="/api",router= users.router)
app.include_router(prefix="/api",router= app1.router)


@app.get("/")
async def root():
    return {"message": "Hello World"}
