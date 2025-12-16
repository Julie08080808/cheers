from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

# SQLite 資料庫路徑
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./data/cheers.db")

# 創建資料庫引擎
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},  # SQLite 需要此設定
    echo=True  # 開發時顯示 SQL 語句
)

# 創建 Session
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 創建 Base 類
Base = declarative_base()

# 依賴注入：獲取資料庫 session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
