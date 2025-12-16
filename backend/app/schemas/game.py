"""
遊戲相關 Pydantic schemas
"""
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

from app.models.game import GameMode, GameStatus, DrinkColor


# ===== 請求 Schemas =====

class GameCreate(BaseModel):
    """創建遊戲請求"""
    mode: GameMode
    player_count: int = Field(..., ge=2, le=8, description="玩家人數 2-8人")


class RollDiceRequest(BaseModel):
    """擲骰子請求"""
    game_id: str


class ActionRequest(BaseModel):
    """執行動作請求"""
    game_id: str
    action_type: str
    data: Optional[dict] = None


class AddDrinkRequest(BaseModel):
    """加酒請求"""
    game_id: str
    color: DrinkColor


class UpdateScoreRequest(BaseModel):
    """更新積分請求"""
    player_index: int = Field(..., ge=0, description="玩家索引")
    delta: int = Field(..., description="積分變化量（可為負數）")


# ===== 回應 Schemas =====

class PlayerInfo(BaseModel):
    """玩家資訊"""
    id: str
    order: int
    score: int
    drink_count: int

    class Config:
        from_attributes = True


class DrinkStackInfo(BaseModel):
    """酒堆疊資訊"""
    id: int
    color: DrinkColor
    added_at: datetime

    class Config:
        from_attributes = True


class GameState(BaseModel):
    """遊戲狀態回應"""
    id: str
    mode: GameMode
    player_count: int
    current_round: int
    current_player_index: int
    status: GameStatus
    base_drink: Optional[str]
    created_at: datetime
    players: List[PlayerInfo]
    drink_stack: List[DrinkStackInfo]

    class Config:
        from_attributes = True


class RollDiceResponse(BaseModel):
    """擲骰子回應"""
    dice1: int
    dice2: int
    total: int
    is_double: bool
    event: str
    description: str


class ResetBaseResponse(BaseModel):
    """重置基底酒回應"""
    message: str
    new_base_drink: DrinkColor
