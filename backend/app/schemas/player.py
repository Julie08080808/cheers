"""
玩家相關 Pydantic schemas
"""
from pydantic import BaseModel


class PlayerCreate(BaseModel):
    """創建玩家請求"""
    game_id: str
    order: int


class PlayerUpdate(BaseModel):
    """更新玩家請求"""
    score: int = 0
    drink_count: int = 0
