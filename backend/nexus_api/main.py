"""
NEXUS-IDP Analytics API — FastAPI entry point.
Runs on port 8000. Frontend proxied via Vite /api/* → http://localhost:8000/api/*.
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware

from .database import init_db
from .websocket import websocket_manager
from .routers import analytics, simulation, drift, rules, copilot, ingest


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="NEXUS-IDP Analytics API",
    version="1.0.0",
    description="Identity Decision Analytics Platform — IDPF Intelligence Backend",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(analytics.router,  prefix="/api/v1/analytics",  tags=["Analytics"])
app.include_router(simulation.router, prefix="/api/v1/simulation", tags=["Simulation"])
app.include_router(drift.router,      prefix="/api/v1/drift",      tags=["Drift"])
app.include_router(rules.router,      prefix="/api/v1/rules",      tags=["Rules"])
app.include_router(copilot.router,    prefix="/api/v1/copilot",    tags=["Copilot"])
app.include_router(ingest.router,     prefix="/api/v1/ingest",     tags=["Ingest"])


@app.websocket("/ws/live")
async def live_stream(websocket: WebSocket):
    await websocket_manager.connect(websocket)


@app.get("/health")
def health():
    from .database import query_one
    count = query_one("SELECT COUNT(*) as c FROM transactions")
    return {"status": "ok", "transactions": count["c"] if count else 0}


@app.get("/")
def root():
    return {"name": "NEXUS-IDP API", "version": "1.0.0", "docs": "/docs"}
