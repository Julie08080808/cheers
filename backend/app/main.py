"""
FastAPI 主應用
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import PROJECT_NAME, VERSION, API_V1_PREFIX, CORS_ORIGINS
from app.database import engine, Base
from app.routers import game, questions

# 創建資料庫表
Base.metadata.create_all(bind=engine)

# 創建 FastAPI 應用
app = FastAPI(
    title=PROJECT_NAME,
    version=VERSION,
    redirect_slashes=False  # 防止尾部斜線問題
)

# 配置 CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 註冊路由
app.include_router(game.router, prefix=f"{API_V1_PREFIX}/game", tags=["game"])
app.include_router(questions.router, prefix=f"{API_V1_PREFIX}/questions", tags=["questions"])


@app.get("/health")
async def health_check():
    """健康檢查端點"""
    return {"status": "ok", "message": "醉加損友 API 運行正常"}


@app.get("/")
async def root():
    """根路徑"""
    return {
        "project": PROJECT_NAME,
        "version": VERSION,
        "message": "歡迎使用醉加損友 API"
    }
