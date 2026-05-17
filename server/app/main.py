from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
from dotenv import load_dotenv

from app.routers import app2, emailassistant, recipegenerator, users, app1, webscraping

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(prefix="/api/user", router=users.router)
app.include_router(prefix="/api", router=app1.router)
app.include_router(prefix="/api", router=app2.router)
app.include_router(prefix="/api", router=webscraping.router)
app.include_router(prefix="/api", router=emailassistant.router)
app.include_router(prefix="/api", router=recipegenerator.router)


@app.get("/")
async def root():
    return {"message": "Hello World"}
