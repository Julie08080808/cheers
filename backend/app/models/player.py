"""
玩家資料庫模型
"""
from sqlalchemy import Column, String, Integer, ForeignKey
from sqlalchemy.orm import relationship
from uuid import uuid4

from app.database import Base


class Player(Base):
    """玩家模型"""
    __tablename__ = "players"

    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    game_id = Column(String, ForeignKey("games.id"), nullable=False)
    order = Column(Integer, nullable=False)  # 玩家順序 (0-based)
    score = Column(Integer, default=0)  # 積分/杯數
    drink_count = Column(Integer, default=0)  # 喝酒次數 (備用)

    # 關聯
    game = relationship("Game", back_populates="players")
