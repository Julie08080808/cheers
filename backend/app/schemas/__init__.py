"""
Pydantic schemas 模組
"""
from app.schemas.game import (
    GameCreate,
    GameState,
    RollDiceRequest,
    RollDiceResponse,
    ActionRequest,
    AddDrinkRequest,
    UpdateScoreRequest,
    ResetBaseResponse,
    PlayerInfo,
    DrinkStackInfo,
)
from app.schemas.player import PlayerCreate, PlayerUpdate
from app.schemas.drink import PourDrinkRequest, LSAQuestion, TruthDareQuestion

__all__ = [
    "GameCreate",
    "GameState",
    "RollDiceRequest",
    "RollDiceResponse",
    "ActionRequest",
    "AddDrinkRequest",
    "UpdateScoreRequest",
    "ResetBaseResponse",
    "PlayerInfo",
    "DrinkStackInfo",
    "PlayerCreate",
    "PlayerUpdate",
    "PourDrinkRequest",
    "LSAQuestion",
    "TruthDareQuestion",
]
