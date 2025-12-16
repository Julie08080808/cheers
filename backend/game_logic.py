import random
from typing import Optional, Dict, Any

# =========================
# 遊戲模式常數
# =========================
FAMILY_MODE = "family"
DRUNK_MODE = "drunk"

# =========================
# 可用幫浦（邏輯層只知道編號）
# =========================
AVAILABLE_PUMPS = [1, 2, 3, 4]

# =========================
# 遊戲規則（秒數）
# =========================
GAME_RULES = {
    FAMILY_MODE: {
        "game_start": 0.5,
        "score": {
            (4, 8): 0.4,
            (7,): 0.6,
        },
        "after_drink": 0.7,
    },
    DRUNK_MODE: {
        "game_start": 0.5,
        "score": {
            (4, 8): 0.6,
            (7,): 0.7,
        },
        "after_drink": 0.7,
    }
}

# =========================
# 工具：隨機選一顆基底幫浦
# =========================
def choose_base_pump() -> int:
    return random.choice(AVAILABLE_PUMPS)


# =========================
# 核心：純規則判斷
# =========================
def resolve_game_event(
    mode: str,
    event: str,
    score: Optional[int] = None,
    base_pump_id: Optional[int] = None
) -> Dict[str, Any]:
    """
    純規則函式（不控制硬體）

    參數：
    - mode: 遊戲模式（family / drunk）
    - event: 事件類型（game_start / score / after_drink）
    - score: 點數（僅 score 事件需要）
    - base_pump_id: 基底幫浦編號（1-4），如果未提供則隨機選擇

    回傳格式：
    {
        success: bool,
        pump_id: int | None,
        duration: float | None,
        message: str
    }
    """

    # 檢查模式
    if mode not in GAME_RULES:
        return {
            "success": False,
            "pump_id": None,
            "duration": None,
            "message": "未知的遊戲模式"
        }

    rules = GAME_RULES[mode]

    # 如果沒有提供 base_pump_id，隨機選擇一個（向下兼容）
    if base_pump_id is None:
        base_pump_id = choose_base_pump()

    # ---------- 遊戲開始 ----------
    if event == "game_start":
        return {
            "success": True,
            "pump_id": base_pump_id,
            "duration": rules["game_start"],
            "message": "遊戲開始倒基底酒"
        }

    # ---------- 點數結算 ----------
    if event == "score":
        if score is None:
            return {
                "success": False,
                "pump_id": None,
                "duration": None,
                "message": "score 事件需要提供點數"
            }

        for score_group, sec in rules["score"].items():
            if score in score_group:
                return {
                    "success": True,
                    "pump_id": base_pump_id,
                    "duration": sec,
                    "message": f"點數 {score} 觸發倒酒"
                }

        return {
            "success": False,
            "pump_id": None,
            "duration": None,
            "message": f"點數 {score} 不觸發倒酒"
        }

    # ---------- 喝完酒 ----------
    if event == "after_drink":
        return {
            "success": True,
            "pump_id": base_pump_id,
            "duration": rules["after_drink"],
            "message": "喝完酒後補基底"
        }

    # ---------- 未知事件 ----------
    return {
        "success": False,
        "pump_id": None,
        "duration": None,
        "message": "未知的遊戲事件"
    }
