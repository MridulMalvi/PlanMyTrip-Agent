"""
TravelAgent AI — FastAPI backend entry point.

Run from the `backend/` directory:
    uvicorn main:app --reload
"""
import sys
import os

# ---------------------------------------------------------------------------
# Path setup: ensure `backend/` and the project root are on sys.path so that
# both `from api.routes import router` and `from crew import build_crew` resolve
# correctly regardless of the working directory.
# ---------------------------------------------------------------------------
_HERE = os.path.dirname(os.path.abspath(__file__))   # .../backend
_ROOT = os.path.dirname(_HERE)                        # .../Travel Agent

for _p in (_HERE, _ROOT):
    if _p not in sys.path:
        sys.path.insert(0, _p)

# ---------------------------------------------------------------------------
# Normal application setup
# ---------------------------------------------------------------------------
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes import router
from core.config import get_settings
from core.logging import setup_logging

settings = get_settings()
logger = setup_logging(debug=settings.debug)

app = FastAPI(
    title=settings.app_name,
    description="Multi-agent AI trip planner powered by CrewAI",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=settings.debug)
