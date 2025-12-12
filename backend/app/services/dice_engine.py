"""
骰子事件引擎
"""
import random
from app.models.game import GameMode


class DiceEngine:
    """骰子事件引擎"""

    # 闔家歡模式事件映射
    FAMILY_EVENTS = {
        3: "lsa_quiz",        # LSA 問答
        5: "lsa_quiz",        # LSA 問答
        4: "random_drink",    # 隨機加酒
        8: "random_drink",    # 隨機加酒
        6: "rock_paper",      # 黑白切
        7: "choose_drink",    # 選擇顏色
        9: "drink_reset",     # 喝酒重置
        10: "truth_dare",     # 真心話大冒險
        11: "truth_dare",     # 真心話大冒險
    }

    # 酒鬼模式事件映射
    ALCOHOLIC_EVENTS = {
        3: "never_have_i",    # 我有你沒有
        5: "arm_wrestling",   # 掰手腕
        4: "random_drink",    # 隨機加酒
        8: "random_drink",    # 隨機加酒
        6: "rock_paper",      # 黑白切
        7: "choose_drink",    # 選擇顏色
        9: "dragon_gate",     # 射龍門
        10: "truth_dare",     # 真心話大冒險
        11: "truth_dare",     # 真心話大冒險
    }

    # 事件描述
    EVENT_DESCRIPTIONS = {
        "lsa_quiz": "LSA 知識大考驗",
        "random_drink": "電腦隨機加一種酒",
        "rock_paper": "黑白切對決",
        "choose_drink": "選擇加入的酒色",
        "drink_reset": "喝酒囉！積分+1，換新基底",
        "drink_penalty": "擲出對子！罰喝一杯",
        "truth_dare": "真心話大冒險",
        "never_have_i": "我有你沒有",
        "arm_wrestling": "掰手腕對決",
        "dragon_gate": "射龍門",
    }

    @staticmethod
    def roll(mode: GameMode) -> dict:
        """
        擲骰子並返回結果

        Args:
            mode: 遊戲模式

        Returns:
            包含骰子結果和事件的字典
        """
        dice1 = random.randint(1, 6)
        dice2 = random.randint(1, 6)
        total = dice1 + dice2
        is_double = dice1 == dice2

        # 判斷事件類型
        if is_double:
            # 對子的特殊處理
            event = "drink_reset" if mode == GameMode.FAMILY else "drink_penalty"
        else:
            # 根據模式選擇事件映射表
            events = DiceEngine.FAMILY_EVENTS if mode == GameMode.FAMILY else DiceEngine.ALCOHOLIC_EVENTS
            event = events.get(total, "unknown")

        # 獲取事件描述
        description = DiceEngine.EVENT_DESCRIPTIONS.get(event, "未知事件")

        return {
            "dice1": dice1,
            "dice2": dice2,
            "total": total,
            "is_double": is_double,
            "event": event,
            "description": description
        }

    @staticmethod
    def get_event_description(event: str) -> str:
        """獲取事件描述"""
        return DiceEngine.EVENT_DESCRIPTIONS.get(event, "未知事件")
