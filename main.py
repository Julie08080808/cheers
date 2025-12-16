from fastapi import FastAPI, HTTPException, Response, Cookie
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import os
import uvicorn
import random
import uuid
from datetime import datetime, timedelta
import db  # 引入 db.py
from pump_controller import pump_controller
from game_logic import resolve_game_event

app=FastAPI() # API物件

# === 遊戲房間管理 ===
class Player:
    def __init__(self, player_id: str, player_name: str):
        self.player_id = player_id
        self.player_name = player_name
        self.joined_at = datetime.now()
        self.last_heartbeat = datetime.now()

class GameRoom:
    def __init__(self):
        self.players: dict[str, Player] = {}  # player_id -> Player
        self.host_id: Optional[str] = None
        self.game_started = False
        self.max_players = 6
        self.min_players = 2
        self.player_order: List[str] = []  # 轉盤抽出的順序

        # 排隊系統
        self.waiting_queue: List[Player] = []  # 等待進入的玩家列表

        # 遊戲狀態
        self.current_turn_index = 0  # 當前輪到的玩家索引
        self.current_round = 1  # 當前回合數
        self.game_mode = 'family'  # 遊戲模式
        self.game_ended = False  # 遊戲是否已結束
        self.game_result = None  # 遊戲結束結果（給前端顯示用）

        # 轉盤狀態
        self.wheel_spinning = False  # 轉盤是否正在旋轉
        self.wheel_finished = False  # 轉盤是否已完成
        self.winner_index = None  # 中獎的索引位置
        self.spin_seed = None  # 隨機種子，用於同步所有客戶端的轉盤動畫
        self.wheel_candidates: List[Player] = []  # 轉盤候選人快照，確保轉動期間一致性

        # 遊戲進行中的共享狀態（所有玩家看到相同畫面）
        self.base_wine_color = None  # 當前基底酒顏色
        self.base_pump_id = None  # 當前基底幫浦編號（1-4），所有玩家使用相同幫浦
        self.dice_values = [1, 1]  # 當前骰子值 [die1, die2]
        self.current_question = None  # 當前題目
        self.current_answer = None  # 當前答案
        self.last_action = None  # 最後的動作（用於顯示訊息）
        self.current_opponent = None  # 當前對手名字（用於黑白切/對決）
        self.wine_stack: List[str] = []  # 加入的酒堆疊 (顏色列表)

        # 積分管理
        self.player_scores: dict[str, int] = {}  # player_id -> score

    def add_player(self, player_name: str) -> tuple[bool, str, str, str]:
        """加入玩家，返回 (成功, player_id, 訊息, 狀態)"""
        player_id = str(uuid.uuid4())
        player = Player(player_id, player_name)

        # 如果房間已滿，加入排隊列表
        if len(self.players) >= self.max_players:
            self.waiting_queue.append(player)
            queue_position = len(self.waiting_queue)
            print(f"📝 玩家加入排隊: {player_name} (ID: {player_id}), 排隊位置: {queue_position}")
            return True, player_id, f"房間已滿，你是第 {queue_position} 位排隊玩家", "in_queue"

        # 房間未滿，直接加入
        self.players[player_id] = player

        # 初始化玩家積分為 0
        self.player_scores[player_id] = 0

        # 第一個加入的玩家成為房主
        if self.host_id is None:
            self.host_id = player_id

        print(f"✅ 玩家加入房間: {player_name} (ID: {player_id})")
        return True, player_id, "成功加入房間", "in_game"

    def remove_player(self, player_id: str):
        """移除玩家"""
        # 檢查是否在遊戲中
        if player_id in self.players:
            player_name = self.players[player_id].player_name
            was_host = (player_id == self.host_id)

            del self.players[player_id]
            # 清除玩家積分
            if player_id in self.player_scores:
                del self.player_scores[player_id]
            print(f"👋 玩家離開: {player_name} (ID: {player_id})")

            # 如果房主離開，將房主轉移給下一個玩家
            if was_host:
                if self.players:
                    new_host_id = next(iter(self.players.keys()))
                    self.host_id = new_host_id
                    new_host_name = self.players[new_host_id].player_name
                    print(f"👑 房主轉移: {player_name} → {new_host_name} (ID: {new_host_id})")
                else:
                    self.host_id = None
                    self.game_started = False
                    self.player_order = []
                    print(f"🏠 房間清空，重置遊戲狀態")

            # 如果有排隊玩家，提升第一個進入房間
            if self.waiting_queue:
                next_player = self.waiting_queue.pop(0)
                self.players[next_player.player_id] = next_player
                # 初始化新玩家積分為 0
                self.player_scores[next_player.player_id] = 0
                print(f"⬆️ 排隊玩家進入房間: {next_player.player_name} (ID: {next_player.player_id})")

        # 檢查是否在排隊列表中
        else:
            self.waiting_queue = [p for p in self.waiting_queue if p.player_id != player_id]
            print(f"📝 玩家離開排隊: (ID: {player_id})")

    def update_heartbeat(self, player_id: str):
        """更新玩家心跳"""
        if player_id in self.players:
            self.players[player_id].last_heartbeat = datetime.now()
        else:
            # 更新排隊中玩家的心跳
            for player in self.waiting_queue:
                if player.player_id == player_id:
                    player.last_heartbeat = datetime.now()
                    break

    def remove_inactive_players(self):
        """移除超過10分鐘沒有心跳的玩家（避免誤踢）"""
        now = datetime.now()

        # 清理遊戲中的不活躍玩家
        inactive_players = [
            pid for pid, player in self.players.items()
            if (now - player.last_heartbeat).total_seconds() > 600  # 10 分鐘 = 600 秒
        ]
        for pid in inactive_players:
            player = self.players.get(pid)
            if player:
                print(f"⚠️ 移除不活躍玩家: {player.player_name} (ID: {pid})")
                self.remove_player(pid)

        # 清理排隊中的不活躍玩家
        self.waiting_queue = [
            player for player in self.waiting_queue
            if (now - player.last_heartbeat).total_seconds() <= 600
        ]

    def can_start_game(self) -> bool:
        """檢查是否可以開始遊戲"""
        return len(self.players) >= self.min_players and not self.game_started

    def start_game(self, player_order: List[str]):
        """開始遊戲"""
        self.game_started = True
        self.player_order = player_order

    def get_player_status(self, player_id: str) -> dict:
        """取得玩家狀態"""
        # 檢查是否在遊戲中
        if player_id in self.players:
            # 判斷當前在哪個畫面
            if not self.game_started:
                screen = "setup"  # 在等待房間
            elif not self.wheel_finished:
                screen = "wheel"  # 轉盤畫面
            else:
                screen = "game"  # 遊戲畫面

            return {
                "status": "in_game",
                "screen": screen,
                "is_host": player_id == self.host_id,
                "queue_position": None
            }

        # 檢查是否在排隊中
        for idx, player in enumerate(self.waiting_queue):
            if player.player_id == player_id:
                return {
                    "status": "in_queue",
                    "screen": None,
                    "is_host": False,
                    "queue_position": idx + 1
                }

        # 玩家不在系統中
        return {
            "status": "not_found",
            "screen": None,
            "is_host": False,
            "queue_position": None
        }

    def reset(self):
        """重置房間"""
        self.players.clear()
        self.waiting_queue.clear()
        self.host_id = None
        self.game_started = False
        self.player_order = []
        self.wheel_spinning = False
        self.wheel_finished = False
        self.winner_index = None
        self.spin_seed = None
        self.wheel_candidates = []
        self.current_turn_index = 0
        self.current_round = 1
        self.game_ended = False
        self.game_result = None
        # 重置遊戲共享狀態
        self.base_wine_color = None
        self.base_pump_id = None
        self.dice_values = [1, 1]
        self.current_question = None
        self.current_answer = None
        self.last_action = None
        self.current_opponent = None
        self.wine_stack.clear()
        # 清空積分
        self.player_scores.clear()

    def get_current_player_id(self) -> Optional[str]:
        """獲取當前輪到的玩家ID"""
        if not self.game_started or not self.player_order:
            return None
        if self.current_turn_index >= len(self.player_order):
            return None
        return self.player_order[self.current_turn_index]

    def next_turn(self):
        """進入下一個玩家的回合"""
        if not self.game_started or not self.player_order:
            return
        self.current_turn_index = (self.current_turn_index + 1) % len(self.player_order)

    def update_score(self, player_id: str, delta: int) -> tuple[bool, int, str]:
        """更新玩家積分，返回 (成功, 新積分, 訊息)"""
        if player_id not in self.players:
            return False, 0, "玩家不存在"

        # 初始化積分（如果還沒有的話）
        if player_id not in self.player_scores:
            self.player_scores[player_id] = 0

        # 更新積分
        self.player_scores[player_id] += delta
        new_score = self.player_scores[player_id]

        player_name = self.players[player_id].player_name
        print(f"📊 積分更新: {player_name} ({delta:+d}) → {new_score}")

        return True, new_score, "積分更新成功"

    def start_wheel_spin(self) -> tuple[bool, str, int]:
        """開始轉盤（只有房主可以呼叫）"""
        if self.wheel_spinning or self.wheel_finished:
            return False, "轉盤已在進行中或已完成", 0

        # 生成隨機種子
        import random
        self.spin_seed = random.randint(1, 10000)
        self.wheel_spinning = True
        self.wheel_finished = False

        # 快照當前玩家列表，確保轉盤過程中的一致性
        self.wheel_candidates = list(self.players.values())

        # 計算中獎索引（基於隨機種子）
        rng = random.Random(self.spin_seed)
        # 使用快照的長度來計算索引
        count = len(self.wheel_candidates)
        self.winner_index = rng.randint(0, count - 1) if count > 0 else 0

        return True, "轉盤開始", self.spin_seed

    def finish_wheel_spin(self) -> List[str]:
        """完成轉盤，返回玩家順序"""
        self.wheel_spinning = False
        self.wheel_finished = True

        # 使用轉盤開始時的快照來計算順序
        candidates = self.wheel_candidates if self.wheel_candidates else list(self.players.values())
        player_ids = [p.player_id for p in candidates]

        # 確保索引有效
        idx = self.winner_index if self.winner_index is not None and self.winner_index < len(player_ids) else 0
        
        ordered_ids = player_ids[idx:] + player_ids[:idx]
        self.player_order = ordered_ids

        return ordered_ids

    def get_wheel_state(self):
        """獲取轉盤狀態"""
        # 如果轉盤正在進行或已完成，使用快照；否則使用當前玩家
        if (self.wheel_spinning or self.wheel_finished) and self.wheel_candidates:
            current_candidates = self.wheel_candidates
        else:
            current_candidates = list(self.players.values())

        return {
            "wheel_spinning": self.wheel_spinning,
            "wheel_finished": self.wheel_finished,
            "winner_index": self.winner_index,
            "spin_seed": self.spin_seed,
            "candidates": [
                {
                    "player_id": p.player_id,
                    "player_name": p.player_name
                }
                for p in current_candidates
            ],
            "player_order": [
                {
                    "player_id": pid,
                    "player_name": self.players[pid].player_name,
                    "order": idx + 1
                }
                for idx, pid in enumerate(self.player_order)
            ] if self.wheel_finished else []
        }

    def get_state(self):
        """獲取房間狀態"""
        current_player_id = self.get_current_player_id()

        return {
            "player_count": len(self.players),
            "players": [
                {
                    "player_id": p.player_id,
                    "player_name": p.player_name,
                    "is_host": p.player_id == self.host_id
                }
                for p in self.players.values()
            ],
            "host_id": self.host_id,
            "game_started": self.game_started,
            "can_start": self.can_start_game(),
            "min_players": self.min_players,
            "max_players": self.max_players,
            # 遊戲狀態
            "current_turn_index": self.current_turn_index,
            "current_player_id": current_player_id,
            "current_round": self.current_round,
            "game_mode": self.game_mode,
            "game_ended": self.game_ended,
            "game_result": self.game_result,
            # 共享遊戲畫面（所有玩家看到相同內容）
            "base_wine_color": self.base_wine_color,
            "base_pump_id": self.base_pump_id,
            "dice_values": self.dice_values,
            "current_question": self.current_question,
            "current_answer": self.current_answer,
            "last_action": self.last_action,
            "current_opponent": self.current_opponent,
            "opponent_name": self.current_opponent,
            "wine_stack": self.wine_stack,
            # 玩家積分（所有玩家看到相同積分）
            "player_scores": self.player_scores
        }

# 全域遊戲房間實例
game_room = GameRoom()

# 設定 CORS，允許前端存取 API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def index():
    # 取得目前檔案 (main.py) 的目錄，並指向 PartyGame/index.html
    base_dir = os.path.dirname(os.path.abspath(__file__))
    file_path = os.path.join(base_dir, "PartyGame/index.html")
    return FileResponse(file_path)

@app.get("/mode")
def mode():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    return FileResponse(os.path.join(base_dir, "PartyGame/mode.html"))

@app.get("/setup")
def setup():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    return FileResponse(os.path.join(base_dir, "PartyGame/setup.html"))

@app.get("/game")
def game():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    return FileResponse(os.path.join(base_dir, "PartyGame/game.html"))

@app.get("/wheel-debug")
def wheel_debug():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    return FileResponse(os.path.join(base_dir, "PartyGame/wheel-debug.html"))

# 定義API路由，回傳隨機問題
@app.get("/api/truth")
def get_truth_question():
    question = random.choice(db.truth_questions)
    return {"question": question}

@app.get("/api/dare")
def get_dare_question():
    question = random.choice(db.dare_questions)
    return {"question": question}

@app.get("/api/lsa")
def get_lsa_question():
    question = random.choice(db.lsa_questions)
    return question  # LSA 題目已經是物件格式，直接返回

# --- 房間管理 API 端點 ---

class JoinRoomRequest(BaseModel):
    player_name: str

class StartGameRequest(BaseModel):
    player_id: str

class HeartbeatRequest(BaseModel):
    player_id: str

class WheelSpinRequest(BaseModel):
    player_id: str

@app.post("/api/room/join")
def join_room(request: JoinRoomRequest, response: Response):
    """玩家加入房間"""
    # 清理不活躍的玩家
    game_room.remove_inactive_players()

    success, player_id, message, status = game_room.add_player(request.player_name)

    if success:
        # 設定 cookie 來記住玩家 ID
        response.set_cookie(
            key="player_id",
            value=player_id,
            max_age=3600,  # 1小時
            path="/",  # 整個網站都有效
            httponly=False,  # 允許 JavaScript 讀取
            samesite="lax"
        )

        # 取得玩家狀態
        player_status = game_room.get_player_status(player_id)

        return {
            "success": True,
            "player_id": player_id,
            "message": message,
            "status": status,
            "queue_position": player_status["queue_position"],
            "room_state": game_room.get_state()
        }
    else:
        raise HTTPException(status_code=400, detail=message)

@app.post("/api/room/leave")
def leave_room(request: HeartbeatRequest):
    """玩家離開房間"""
    game_room.remove_player(request.player_id)
    return {"success": True, "message": "已離開房間"}

@app.get("/api/player/state")
def get_player_state(player_id: Optional[str] = Cookie(None)):
    """取得玩家狀態（用於頁面載入時檢查）"""
    if not player_id:
        return {
            "status": "not_found",
            "screen": None,
            "is_host": False,
            "queue_position": None
        }

    # 清理不活躍的玩家
    game_room.remove_inactive_players()

    return game_room.get_player_status(player_id)

@app.get("/api/room/state")
def get_room_state(player_id: Optional[str] = Cookie(None)):
    """獲取房間狀態（用於輪詢）"""
    # 清理不活躍的玩家
    game_room.remove_inactive_players()

    state = game_room.get_state()

    # 檢查請求的玩家是否還在房間中
    if player_id:
        state["is_in_room"] = player_id in game_room.players
        state["is_host"] = player_id == game_room.host_id
        state["my_player_id"] = player_id
    else:
        state["is_in_room"] = False
        state["is_host"] = False
        state["my_player_id"] = None

    return state

@app.post("/api/room/heartbeat")
def heartbeat(request: HeartbeatRequest):
    """玩家心跳，保持連線"""
    game_room.update_heartbeat(request.player_id)
    return {"success": True}

@app.post("/api/room/start")
def start_game(request: StartGameRequest):
    """房主開始遊戲（進入轉盤畫面）"""
    # 檢查是否為房主
    if request.player_id != game_room.host_id:
        raise HTTPException(status_code=403, detail="只有房主可以開始遊戲")

    # 檢查是否可以開始
    if not game_room.can_start_game():
        raise HTTPException(
            status_code=400,
            detail=f"需要至少 {game_room.min_players} 人才能開始遊戲"
        )

    # 只設定遊戲已開始，不設定玩家順序（順序由轉盤決定）
    game_room.game_started = True

    # 重置轉盤狀態，確保新遊戲可以轉動
    game_room.wheel_spinning = False
    game_room.wheel_finished = False
    game_room.winner_index = None
    game_room.spin_seed = None
    game_room.wheel_candidates = []

    return {
        "success": True,
        "message": "遊戲開始！進入轉盤畫面"
    }

@app.post("/api/room/reset")
def reset_room():
    """重置房間（用於測試或結束遊戲後）"""
    game_room.reset()
    return {"success": True, "message": "房間已重置"}

# --- 轉盤 API 端點 ---

@app.post("/api/wheel/spin")
def spin_wheel(request: WheelSpinRequest):
    """開始轉盤（只有房主可以呼叫）"""
    # 檢查是否為房主
    if request.player_id != game_room.host_id:
        raise HTTPException(status_code=403, detail="只有房主可以轉動轉盤")

    # 檢查遊戲是否已開始
    if not game_room.game_started:
        raise HTTPException(status_code=400, detail="遊戲尚未開始")

    # 開始轉盤
    success, message, seed = game_room.start_wheel_spin()

    if not success:
        raise HTTPException(status_code=400, detail=message)

    return {
        "success": True,
        "message": message,
        "spin_seed": seed,
        "winner_index": game_room.winner_index
    }

@app.post("/api/wheel/finish")
def finish_wheel():
    """完成轉盤，設定玩家順序"""
    # 如果已經完成，直接返回成功（允許多個客戶端呼叫）
    if game_room.wheel_finished:
        return {
            "success": True,
            "message": "轉盤已完成",
            "player_order": game_room.get_wheel_state()["player_order"]
        }

    # 如果還在旋轉中，完成它
    if game_room.wheel_spinning:
        ordered_ids = game_room.finish_wheel_spin()
        return {
            "success": True,
            "message": "轉盤完成",
            "player_order": game_room.get_wheel_state()["player_order"]
        }

    # 如果既沒在旋轉也沒完成，表示狀態錯誤
    raise HTTPException(status_code=400, detail="轉盤狀態錯誤")

@app.get("/api/wheel/state")
def get_wheel_state():
    """獲取轉盤狀態（用於輪詢同步）"""
    return game_room.get_wheel_state()

class NextTurnRequest(BaseModel):
    player_id: str

@app.post("/api/game/next-turn")
def next_turn(request: NextTurnRequest):
    """進入下一個玩家的回合（只有當前玩家可以呼叫）"""
    if not game_room.game_started:
        raise HTTPException(status_code=400, detail="遊戲尚未開始")

    # 檢查是否輪到該玩家（只有當前玩家才能結束自己的回合）
    current_player_id = game_room.get_current_player_id()
    if request.player_id != current_player_id:
        raise HTTPException(status_code=403, detail="還沒輪到你，不能切換回合")

    game_room.next_turn()

    return {
        "success": True,
        "current_turn_index": game_room.current_turn_index,
        "current_player_id": game_room.get_current_player_id()
    }

@app.get("/api/game/state")
def get_game_state(player_id: Optional[str] = Cookie(None)):
    """獲取遊戲狀態（包含當前輪到誰）"""
    if not game_room.game_started:
        raise HTTPException(status_code=400, detail="遊戲尚未開始")

    state = game_room.get_state()

    # 檢查是否輪到請求的玩家
    if player_id:
        state["is_my_turn"] = player_id == game_room.get_current_player_id()
        state["my_player_id"] = player_id
    else:
        state["is_my_turn"] = False
        state["my_player_id"] = None

    return state

# --- 遊戲動作 API 端點（同步所有玩家） ---

class RollDiceRequest(BaseModel):
    player_id: str
    dice1: int
    dice2: int

class SetBaseWineRequest(BaseModel):
    player_id: str
    color: Optional[str] = None  # 可選，如果不提供則後端隨機選擇

class SetQuestionRequest(BaseModel):
    player_id: str
    question: str
    answer: Optional[str] = None

@app.post("/api/game/roll-dice")
def roll_dice(request: RollDiceRequest):
    """玩家擲骰子（同步到所有玩家）"""
    if not game_room.game_started:
        raise HTTPException(status_code=400, detail="遊戲尚未開始")

    # 檢查是否輪到該玩家
    if request.player_id != game_room.get_current_player_id():
        raise HTTPException(status_code=403, detail="還沒輪到你")

    # 更新骰子值（所有玩家將看到相同的骰子）
    game_room.dice_values = [request.dice1, request.dice2]
    game_room.last_action = f"擲出 {request.dice1} 和 {request.dice2}"

    print(f"🎲 玩家擲骰子: {request.dice1}, {request.dice2}")

    # 預先隨機選擇一個對手（為了黑白切/對決模式），避免前端顯示 undefined
    # 這樣即使前端沒有呼叫 pick-opponent，也能顯示一個隨機對手
    candidates = [p for pid, p in game_room.players.items() if pid != request.player_id]
    if candidates:
        opponent = random.choice(candidates)
        game_room.current_opponent = opponent.player_name
    else:
        game_room.current_opponent = "無其他玩家"

    return {
        "success": True,
        "dice_values": game_room.dice_values,
        "sum": request.dice1 + request.dice2,
        "current_opponent": game_room.current_opponent,
        "opponent_name": game_room.current_opponent
    }

@app.post("/api/game/set-base-wine")
def set_base_wine(request: SetBaseWineRequest):
    """設定基底酒（所有玩家看到相同基底）"""
    # 移除遊戲開始檢查，允許隨時設定基底酒

    # 如果沒有提供顏色，後端隨機選擇
    if request.color:
        chosen_color = request.color
        print(f"🎯 使用指定基底酒: {chosen_color}")
    else:
        import random
        wine_colors = ['red', 'blue', 'yellow', 'green']

        # 避免連續選到相同顏色（至少嘗試選擇不同的）
        if game_room.base_wine_color and len(wine_colors) > 1:
            available_colors = [c for c in wine_colors if c != game_room.base_wine_color]
            chosen_color = random.choice(available_colors)
            print(f"🎲 後端隨機選擇基底酒（避免重複）: {chosen_color} (上次: {game_room.base_wine_color})")
        else:
            chosen_color = random.choice(wine_colors)
            print(f"🎲 後端隨機選擇基底酒: {chosen_color}")

    # 同時隨機選擇一個基底幫浦（1-4），並同步到所有玩家
    import random

    # 避免連續選到相同幫浦
    if game_room.base_pump_id and game_room.base_pump_id in [1, 2, 3, 4]:
        available_pumps = [p for p in [1, 2, 3, 4] if p != game_room.base_pump_id]
        game_room.base_pump_id = random.choice(available_pumps)
        print(f"🎲 後端隨機選擇基底幫浦（避免重複）: {game_room.base_pump_id}")
    else:
        game_room.base_pump_id = random.choice([1, 2, 3, 4])
        print(f"🎲 後端隨機選擇基底幫浦: {game_room.base_pump_id}")

    game_room.base_wine_color = chosen_color
    game_room.wine_stack.clear()  # 清空酒堆疊
    print(f"🍷 設定基底酒: {chosen_color}（幫浦 {game_room.base_pump_id}），清空酒堆疊")

    return {
        "success": True,
        "base_wine_color": game_room.base_wine_color,
        "base_pump_id": game_room.base_pump_id,
        "wine_stack": game_room.wine_stack
    }

class AddWineRequest(BaseModel):
    player_id: str
    color: str

@app.post("/api/game/add-wine")
def add_wine_to_stack(request: AddWineRequest):
    """添加酒到堆疊（所有玩家看到相同的酒堆疊）"""
    if not game_room.game_started:
        raise HTTPException(status_code=400, detail="遊戲尚未開始")

    game_room.wine_stack.append(request.color)
    print(f"🍷 添加酒到堆疊: {request.color}，目前堆疊: {game_room.wine_stack}")

    return {
        "success": True,
        "color": request.color,
        "wine_stack": game_room.wine_stack
    }

@app.post("/api/game/set-question")
def set_question(request: SetQuestionRequest):
    """設定當前題目（所有玩家看到相同題目）"""
    if not game_room.game_started:
        raise HTTPException(status_code=400, detail="遊戲尚未開始")

    game_room.current_question = request.question
    game_room.current_answer = request.answer

    print(f"❓ 設定題目: {request.question}")

    return {
        "success": True,
        "question": game_room.current_question,
        "answer": game_room.current_answer
    }

class UpdateScoreRequest(BaseModel):
    player_id: str
    score_delta: int

class IncrementRoundRequest(BaseModel):
    player_id: str
    new_round: int

@app.post("/api/game/update-score")
def update_score(request: UpdateScoreRequest):
    """更新玩家積分（同步到所有玩家）"""
    if not game_room.game_started:
        raise HTTPException(status_code=400, detail="遊戲尚未開始")

    # 更新積分
    success, new_score, message = game_room.update_score(request.player_id, request.score_delta)

    if not success:
        raise HTTPException(status_code=400, detail=message)

    # 檢查遊戲是否結束（酒鬼模式：有人喝滿3杯）
    if game_room.game_mode == 'drunk' and new_score >= 3:
        game_room.game_ended = True
        player_name = game_room.players[request.player_id].player_name if request.player_id in game_room.players else "玩家"
        
        # 找出贏家（除了輸家以外的所有人）和輸家
        winners = []
        losers = [{"player_id": request.player_id, "player_name": player_name, "score": new_score}]
        
        for pid, p in game_room.players.items():
            if pid != request.player_id:
                score = game_room.player_scores.get(pid, 0)
                winners.append({"player_id": pid, "player_name": p.player_name, "score": score})

        game_room.game_result = {
            "mode": "drunk",
            "winners": winners,
            "losers": losers,
            "message": f"{player_name} 已經喝了 3 杯！遊戲結束！"
        }
        print(f"🏁 遊戲結束！{player_name} 喝了 {new_score} 杯")

    return {
        "success": True,
        "player_id": request.player_id,
        "score_delta": request.score_delta,
        "new_score": new_score,
        "message": message
    }

@app.post("/api/game/increment-round")
def increment_round(request: IncrementRoundRequest):
    """增加回合數（闔家歡模式專用）"""
    if not game_room.game_started:
        raise HTTPException(status_code=400, detail="遊戲尚未開始")

    # 只在闔家歡模式更新回合
    if game_room.game_mode == 'family':
        game_room.current_round = request.new_round
        print(f"🍺 回合更新: {request.new_round}")

        # 檢查遊戲是否結束（闔家歡模式：完成5回合）
        if game_room.current_round > 5:
            game_room.game_ended = True

            # 計算最高分和最低分
            max_score = -999
            min_score = 999
            for player_id, score in game_room.player_scores.items():
                if score > max_score:
                    max_score = score
                if score < min_score:
                    min_score = score

            # 找出贏家和輸家
            winners = []
            losers = []
            for player_id, score in game_room.player_scores.items():
                if player_id in game_room.players:
                    player_name = game_room.players[player_id].player_name
                    if score == max_score:
                        winners.append({"player_id": player_id, "player_name": player_name, "score": score})
                    if score == min_score:
                        losers.append({"player_id": player_id, "player_name": player_name, "score": score})

            game_room.game_result = {
                "mode": "family",
                "max_score": max_score,
                "min_score": min_score,
                "winners": winners,
                "losers": losers,
                "message": f"已完成 5 回合！遊戲結束！"
            }
            print(f"🏁 遊戲結束！完成 5 回合")

        return {
            "success": True,
            "current_round": game_room.current_round,
            "message": f"回合已更新為 {game_room.current_round}"
        }
    else:
        return {
            "success": False,
            "message": "酒鬼模式不使用回合制"
        }

class PickOpponentRequest(BaseModel):
    player_id: str

@app.post("/api/game/pick-opponent")
def pick_opponent(request: PickOpponentRequest):
    """隨機選擇一個對手（用於黑白切/對決），解決顯示 undefined 的問題"""
    if not game_room.game_started:
        raise HTTPException(status_code=400, detail="遊戲尚未開始")

    # 取得當前玩家名字
    current_player_name = game_room.players[request.player_id].player_name if request.player_id in game_room.players else "玩家"

    # 篩選出除了自己以外的潛在對手
    candidates = [p for pid, p in game_room.players.items() if pid != request.player_id]

    if candidates:
        # 隨機選擇一位對手
        opponent = random.choice(candidates)
        game_room.current_opponent = opponent.player_name
        
        # 更新最後動作，讓所有人都看到
        game_room.last_action = f"{current_player_name} 的對手是 {opponent.player_name}！"
        print(f"⚔️ 對決配對: {current_player_name} vs {opponent.player_name}")
    else:
        game_room.current_opponent = "無其他玩家"
        game_room.last_action = "沒有其他玩家可以對戰！"

    return {
        "success": True,
        "opponent_name": game_room.current_opponent,
        "current_opponent": game_room.current_opponent,
        "message": f"對手是 {game_room.current_opponent}"
    }

# =========================================================
# 遊戲事件（唯一推薦的「正式遊戲流程」入口）
# =========================================================
class GameEventRequest(BaseModel):
    mode: str                 # family / drunk
    event: str                # game_start / score / after_drink
    score: Optional[int] = None

def _decision_to_actions(decision: Dict[str, Any]) -> List[Dict[str, float]]:
    """
    相容處理：resolve_game_event 可能回傳兩種格式
    A) {"success": True, "actions": [{"pump_id":1,"duration":0.5}, ...]}
    B) {"success": True, "pump_id": 1, "duration": 0.5}
    這裡統一轉成 actions list
    """
    if not decision.get("success"):
        return []

    if isinstance(decision.get("actions"), list) and decision["actions"]:
        # 確保每個 action 都有 pump_id / duration
        actions: List[Dict[str, float]] = []
        for a in decision["actions"]:
            if "pump_id" in a and "duration" in a:
                actions.append({"pump_id": int(a["pump_id"]), "duration": float(a["duration"])})
        return actions

    # fallback: 單顆
    if "pump_id" in decision and "duration" in decision:
        return [{"pump_id": int(decision["pump_id"]), "duration": float(decision["duration"])}]

    return []


@app.post("/api/game/reset")
def reset_game():
    """重置遊戲狀態，準備開始新的一局"""
    try:
        # 重置房間狀態（包括回合數、積分、遊戲記錄等）
        # 但保留玩家列表，讓同一批玩家可以繼續玩
        game_room.game_started = False
        game_room.player_order = []
        game_room.current_turn_index = 0
        game_room.current_round = 1  # 回合數重置為 1
        game_room.game_ended = False
        game_room.game_result = None
        
        # 重置轉盤狀態
        game_room.wheel_spinning = False
        game_room.wheel_finished = False
        game_room.winner_index = None
        game_room.spin_seed = None
        game_room.wheel_candidates = []
        
        # 重置遊戲共享狀態
        game_room.base_wine_color = None
        game_room.base_pump_id = None
        game_room.dice_values = [1, 1]
        game_room.current_question = None
        game_room.current_answer = None
        game_room.last_action = None
        game_room.current_opponent = None
        game_room.wine_stack.clear()
        
        # 重置所有玩家的積分為 0
        for player_id in game_room.players.keys():
            game_room.player_scores[player_id] = 0
        
        print("🔄 遊戲狀態已重置，準備開始新的一局")
        
        return {
            "success": True,
            "message": "遊戲狀態已重置",
            "current_round": game_room.current_round
        }
    except Exception as e:
        print(f"❌ 重置遊戲失敗: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/game/event")
def game_event(request: GameEventRequest):
    """
    遊戲事件入口：前端只送 event / mode / score
    後端用 game_logic 決定要啟動哪顆幫浦、幾秒，然後呼叫 pump_controller
    """
    # 使用房間的基底幫浦編號，確保所有玩家使用相同的幫浦
    decision = resolve_game_event(
        mode=request.mode,
        event=request.event,
        score=request.score,
        base_pump_id=game_room.base_pump_id
    )

    if not decision.get("success"):
        # 不觸發倒酒也算正常回覆
        return decision

    actions = _decision_to_actions(decision)
    if not actions:
        raise HTTPException(status_code=500, detail="game_logic 回傳格式不正確（找不到 actions 或 pump_id/duration）")

    # 執行幫浦
    for action in actions:
        pump_controller.pump_out(action["pump_id"], action["duration"])

    # 回傳決策結果（前端可用來顯示顏色/提示）
    # 也把 actions 填回去，讓回傳格式固定
    decision["actions"] = actions
    return decision

# =========================================================
# （可保留）硬體測試用 API：直接控制幫浦 / LED
# =========================================================
class PumpRequest(BaseModel):
    player_id: int           # 幫浦編號: 1-4；若 stop 用 0 表示全部
    duration: Optional[float] = None

class LEDRequest(BaseModel):
    player_id: int
    state: bool

@app.post("/api/pump/out")
def pump_out_api(request: PumpRequest):
    """測試用：直接控制幫浦出水"""
    try:
        pump_controller.pump_out(request.player_id, request.duration or 1.0)
        return {"success": True, "message": f"幫浦 {request.player_id} 已運行"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/pump/stop")
def emergency_stop_api(request: PumpRequest):
    """緊急停止幫浦"""
    try:
        if request.player_id == 0:
            pump_controller.emergency_stop()
            return {"success": True, "message": "所有幫浦已緊急停止"}
        pump_controller.stop(request.player_id)
        return {"success": True, "message": f"幫浦 {request.player_id} 已停止"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 清理GPIO資源（當應用關閉時）
@app.on_event("shutdown")
def shutdown_event():
    pump_controller.cleanup()


# 為靜態資源創建明確的路由（避免 mount at "/" 覆蓋其他路由）
@app.get("/style.css")
def serve_css():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    return FileResponse(os.path.join(base_dir, "PartyGame/style.css"))

@app.get("/script.js")
def serve_js():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    return FileResponse(os.path.join(base_dir, "PartyGame/script.js"))

@app.get("/cover.jpg")
def serve_cover():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    return FileResponse(os.path.join(base_dir, "PartyGame/cover.jpg"))

@app.get("/gameover.png")
def serve_gameover():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    return FileResponse(os.path.join(base_dir, "PartyGame/gameover.png"))

if __name__ == "__main__":
    # 確保監聽所有網路介面
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
