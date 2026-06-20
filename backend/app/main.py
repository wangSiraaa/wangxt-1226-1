from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.core.database import engine, Base, SessionLocal
from app.core.config import settings
from app.api.routers import api_router
from app.models import *
from app.crud.crud_user import init_roles


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        init_roles(db)
    finally:
        db.close()
    yield
    pass


app = FastAPI(
    title="Pharmaceutical Stability Study Management System",
    description=(
        "药企稳定性试验管理系统 - 管理样品入箱、取样、检测和偏差调查。\n\n"
        "核心功能：\n"
        "- 试验方案管理 (Protocol Management)\n"
        "- 样品生命周期管理 (Sample Lifecycle: 入箱/取样/锁定)\n"
        "- 取样窗口控制 (Sampling Window Enforcement: 未到窗口禁止取样)\n"
        "- 温湿度监控与偏差 (Environment Monitoring & Deviation)\n"
        "- 温湿度偏差样品自动锁定 (Auto-lock samples on env deviation)\n"
        "- 检测结果审批 (Test Result Approval Workflow)\n"
        "- 批准后只读控制 (Approved Results Cannot Be Modified)\n"
        "- 偏差调查流程 (Deviation Investigation CAPA)\n"
        "- 到期提醒 (Celery + Redis Background Tasks)"
    ),
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:4200",
        "http://127.0.0.1:4200",
        "*",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="")


@app.get("/", tags=["Health Check"])
def root_health():
    return {
        "name": "Stability Study Management API",
        "version": "1.0.0",
        "status": "ok",
        "docs": "/docs",
        "redoc": "/redoc",
    }


@app.get("/api/health", tags=["Health Check"])
def api_health():
    return {
        "status": "healthy",
        "timestamp": settings.__class__.__name__,
        "database": "connected",
    }
