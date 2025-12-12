"""
配置管理模組
"""
from pathlib import Path

# 專案根目錄
BASE_DIR = Path(__file__).resolve().parent.parent

# 資料庫設定
DATABASE_URL = f"sqlite:///{BASE_DIR}/data/cheers.db"

# API 設定
API_V1_PREFIX = "/api"
PROJECT_NAME = "醉加損友 Cheers API"
VERSION = "2.0.0"

# CORS 設定
CORS_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:8000",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:8000",
]

# 遊戲設定
DEFAULT_ROUNDS = 5  # 闔家歡模式預設回合數
DRUNK_MODE_MAX_DRINKS = 3  # 酒鬼模式最大杯數
