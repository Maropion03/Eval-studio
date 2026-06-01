"""FastAPI app entry. Mount routes + middleware."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app import __version__
from app.api.api import api_router
from app.core.config import get_settings
from app.core.ratelimit import limiter
from app.core.session import SessionMiddleware

settings = get_settings()

app = FastAPI(
    title="Eval Studio v2 API",
    version=__version__,
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
)

# Order matters: CORS → session → ratelimit (deep to shallow)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(SessionMiddleware)
app.add_middleware(SlowAPIMiddleware)

app.state.limiter = limiter


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(_, exc):
    from fastapi.responses import JSONResponse
    return JSONResponse(status_code=429, content={"detail": f"rate limit exceeded: {exc.detail}"})


app.include_router(api_router, prefix="/api")


@app.get("/")
async def root():
    return {
        "service": "eval-studio-api",
        "version": __version__,
        "docs": "/api/docs",
    }


@app.get("/health")
async def health():
    return {"ok": True}
