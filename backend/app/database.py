"""
資料庫連線管理
"""
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.config import DATABASE_URL

# 創建資料庫引擎
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False}  # SQLite 需要此設定
)

# 創建 SessionLocal 類別
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 創建 Base 類別
Base = declarative_base()

# 資料庫依賴注入
def get_db():
    """
    提供資料庫 session
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
