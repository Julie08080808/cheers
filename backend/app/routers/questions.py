"""
題庫路由
"""
from fastapi import APIRouter, HTTPException
import json
import random
from pathlib import Path

from app.config import BASE_DIR

router = APIRouter()

# 載入題庫
LSA_QUESTIONS_PATH = BASE_DIR / "data" / "questions_lsa.json"
TRUTH_QUESTIONS_PATH = BASE_DIR / "data" / "questions_truth.json"


def load_lsa_questions():
    """載入 LSA 問題"""
    try:
        with open(LSA_QUESTIONS_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return []


def load_truth_questions():
    """載入真心話大冒險問題"""
    try:
        with open(TRUTH_QUESTIONS_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return []


@router.get("/lsa/random")
async def get_random_lsa():
    """隨機獲取一個 LSA 問答"""
    questions = load_lsa_questions()
    if not questions:
        raise HTTPException(status_code=404, detail="題庫為空")

    return random.choice(questions)


@router.get("/lsa/all")
async def get_all_lsa():
    """獲取所有 LSA 問答"""
    questions = load_lsa_questions()
    return questions


@router.get("/truth/random")
async def get_random_truth():
    """隨機獲取一個真心話大冒險"""
    questions = load_truth_questions()
    if not questions:
        raise HTTPException(status_code=404, detail="題庫為空")

    return random.choice(questions)


@router.get("/truth/random/{type}")
async def get_random_truth_by_type(type: str):
    """根據類型隨機獲取真心話大冒險"""
    questions = load_truth_questions()
    if not questions:
        raise HTTPException(status_code=404, detail="題庫為空")

    # 過濾類型
    filtered = [q for q in questions if q.get("type") == type]
    if not filtered:
        return random.choice(questions)

    return random.choice(filtered)


@router.get("/truth/all")
async def get_all_truth():
    """獲取所有真心話大冒險"""
    questions = load_truth_questions()
    return questions
