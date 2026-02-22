"""
Eval Studio Backend — FastAPI Application Entry Point

LLM Evaluation Platform API Server.
Provides REST endpoints for dataset management, evaluation runs,
A/B comparison, playground debugging, and settings.
"""

import traceback
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.api import api_router
from app.core.config import settings
from app.db.session import engine
from app.models.models import Base


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create database tables on startup."""
    Base.metadata.create_all(bind=engine)
    print(f"✅ Database ready: {settings.db_path}")
    print(f"🚀 Eval Studio API running at http://{settings.host}:{settings.port}")
    print(f"📖 Docs at http://{settings.host}:{settings.port}/docs")
    yield


app = FastAPI(
    title="Eval Studio API",
    description="LLM Evaluation Platform — evaluate, compare, and debug AI model outputs.",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS — allow frontend dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=[
        "*",
        "x-llm-key",
        "x-llm-model",
        "x-llm-base-url",
        "x-session-id",
        "Authorization",
        "Content-Type",
    ],
)


@app.exception_handler(Exception)
async def debug_exception_handler(request: Request, exc: Exception):
    """Global exception handler for debugging — prints full traceback."""
    error_msg = "".join(traceback.format_exception(None, exc, exc.__traceback__))
    print(f"❌ UNHANDLED EXCEPTION for {request.url.path}:\n{error_msg}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal Server Error", "trace": str(exc)},
    )


# Mount all API routes
app.include_router(api_router)


@app.get("/health")
def health_check():
    """Health check endpoint."""
    return {"status": "ok", "service": "eval-studio-api", "version": "0.1.0"}
