import time
import logging
from typing import Dict

# =========================
# GPIO 嘗試載入（支援模擬）
# =========================
try:
    import RPi.GPIO as GPIO
    SIMULATION_MODE = False
except (ImportError, RuntimeError):
    SIMULATION_MODE = True

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# =========================
# 幫浦 GPIO 腳位設定
# （依你的接線圖調整）
# =========================
PUMP_PINS: Dict[int, Dict[str, int]] = {
    1: {"in1": 22, "in2": 27},
    2: {"in1": 17, "in2": 4},
    3: {"in1": 19, "in2": 13},
    4: {"in1": 6,  "in2": 5},
}


class PumpController:
    """
    純硬體控制層
    - 不知道遊戲規則
    - 不知道 FastAPI
    """

    def __init__(self):
        self.initialized = False
        if not SIMULATION_MODE:
            self._init_gpio()

    def _init_gpio(self):
        GPIO.setmode(GPIO.BCM)
        GPIO.setwarnings(False)

        for pump_id, pins in PUMP_PINS.items():
            GPIO.setup(pins["in1"], GPIO.OUT, initial=GPIO.LOW)
            GPIO.setup(pins["in2"], GPIO.OUT, initial=GPIO.LOW)
            logger.info(f"幫浦 {pump_id} 初始化完成")

        self.initialized = True

    # =========================
    # 內部工具
    # =========================
    def _set_motor(self, pump_id: int, in1: bool, in2: bool):
        if pump_id not in PUMP_PINS:
            raise ValueError(f"無效的 pump_id: {pump_id}")

        pins = PUMP_PINS[pump_id]

        if SIMULATION_MODE:
            logger.info(
                f"[模擬] 幫浦{pump_id} "
                f"IN1={'HIGH' if in1 else 'LOW'}, "
                f"IN2={'HIGH' if in2 else 'LOW'}"
            )
            return

        GPIO.output(pins["in1"], GPIO.HIGH if in1 else GPIO.LOW)
        GPIO.output(pins["in2"], GPIO.HIGH if in2 else GPIO.LOW)

    # =========================
    # 對外 API（給 main.py 用）
    # =========================
    def pump_out(self, pump_id: int, duration: float):
        """
        啟動幫浦出水（單方向）
        """
        logger.info(f"幫浦 {pump_id} 出水 {duration} 秒")

        # 正轉（依你實際接線，必要時對調）
        self._set_motor(pump_id, True, False)
        time.sleep(duration)
        self.stop(pump_id)

    def stop(self, pump_id: int):
        """
        停止指定幫浦
        """
        logger.info(f"幫浦 {pump_id} 停止")
        self._set_motor(pump_id, False, False)

    def emergency_stop(self):
        """
        緊急停止所有幫浦
        """
        logger.warning("緊急停止所有幫浦")
        for pump_id in PUMP_PINS.keys():
            self.stop(pump_id)

    def cleanup(self):
        """
        程式結束時呼叫
        """
        self.emergency_stop()
        if not SIMULATION_MODE and self.initialized:
            GPIO.cleanup()
            logger.info("GPIO cleanup 完成")


# 全域實例（main.py 直接 import 用）
pump_controller = PumpController()
