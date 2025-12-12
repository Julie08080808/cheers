"""
調酒/題庫相關 Pydantic schemas
"""
from pydantic import BaseModel
from typing import List, Optional

from app.models.game import DrinkColor


class PourDrinkRequest(BaseModel):
    """倒酒請求"""
    recipe_name: Optional[str] = None
    colors: Optional[List[DrinkColor]] = None


class LSAQuestion(BaseModel):
    """LSA 問題"""
    q: str
    options: List[str]
    ans: int


class TruthDareQuestion(BaseModel):
    """真心話大冒險問題"""
    content: str
