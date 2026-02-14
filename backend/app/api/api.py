"""
API Router aggregation — mounts all endpoint routers.
"""

from fastapi import APIRouter

from app.api.endpoints import datasets, runs, playground, compare, settings

api_router = APIRouter(prefix="/api")

api_router.include_router(datasets.router)
api_router.include_router(runs.router)
api_router.include_router(playground.router)
api_router.include_router(compare.router)
api_router.include_router(settings.router)
