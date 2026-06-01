from fastapi import APIRouter

from app.api.endpoints import datasets, experiments, runs, settings

api_router = APIRouter()
api_router.include_router(datasets.router)
api_router.include_router(experiments.router)
api_router.include_router(runs.router)
api_router.include_router(settings.router)
