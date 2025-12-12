"""
遊戲相關資料庫模型
"""
from sqlalchemy import Column, String, Integer, Enum as SQLEnum, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from uuid import uuid4
from enum import Enum

from app.database import Base


class GameMode(str, Enum):
    """遊戲模式"""
    FAMILY = "family"  # 闔家歡模式
    ALCOHOLIC = "alcoholic"  # 酒鬼模式


class GameStatus(str, Enum):
    """遊戲狀態"""
    WAITING = "waiting"  # 等待中
    PLAYING = "playing"  # 進行中
    FINISHED = "finished"  # 已結束


class DrinkColor(str, Enum):
    """酒色"""
    RED = "red"
    BLUE = "blue"
    YELLOW = "yellow"


class Game(Base):
    """遊戲模型"""
    __tablename__ = "games"

    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    mode = Column(SQLEnum(GameMode), nullable=False)
    player_count = Column(Integer, nullable=False)
    current_round = Column(Integer, default=1)
    current_player_index = Column(Integer, default=0)
    status = Column(SQLEnum(GameStatus), default=GameStatus.WAITING)
    base_drink = Column(String, nullable=True)  # 基底酒顏色
    created_at = Column(DateTime, default=datetime.utcnow)

    # 關聯
    players = relationship("Player", back_populates="game", cascade="all, delete-orphan")
    drink_stack = relationship("DrinkStack", back_populates="game", cascade="all, delete-orphan")


class DrinkStack(Base):
    """酒堆疊模型"""
    __tablename__ = "drink_stacks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    game_id = Column(String, ForeignKey("games.id"), nullable=False)
    color = Column(SQLEnum(DrinkColor), nullable=False)
    added_at = Column(DateTime, default=datetime.utcnow)

    # 關聯
    game = relationship("Game", back_populates="drink_stack")
