from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.main import api_router

app = FastAPI(title=settings.PROJECT_NAME)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_origin_regex=r"https://.*\.vercel\.app|https://.*\.onrender\.com",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from fastapi.staticfiles import StaticFiles
import os

app.include_router(api_router, prefix="/api/v1")

os.makedirs("static", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/health")
async def health_check():
    return {"status": "ok"}

@app.get("/health/celery")
async def celery_health_check():
    from app.core.celery_app import celery_app
    try:
        # A lightweight way to check if the broker is reachable
        # This checks if there are any active queues
        with celery_app.connection_for_read() as conn:
            conn.default_channel.queue_declare("celery", passive=True)
        return {"status": "ok", "broker": "reachable"}
    except Exception as e:
        return {"status": "error", "detail": str(e)}
