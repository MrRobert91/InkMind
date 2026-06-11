import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import models  # noqa: F401 — register models with the metadata
from .database import Base, engine, wait_for_db
from .routers import ai, chapters, characters, projects

app = FastAPI(title="InkMind API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(projects.router)
app.include_router(chapters.router)
app.include_router(characters.router)
app.include_router(ai.router)


@app.on_event("startup")
def on_startup():
    wait_for_db()
    Base.metadata.create_all(bind=engine)


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "ai_configured": bool(os.getenv("ANTHROPIC_API_KEY")),
    }
