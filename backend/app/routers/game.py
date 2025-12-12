"""
遊戲路由
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import random

from app.database import get_db
from app.models.game import Game, GameStatus, DrinkStack, DrinkColor
from app.models.player import Player
from app.schemas.game import (
    GameCreate,
    GameState,
    RollDiceResponse,
    AddDrinkRequest,
    UpdateScoreRequest,
    ResetBaseResponse,
)
from app.services.dice_engine import DiceEngine

router = APIRouter()


@router.post("/", response_model=GameState)
async def create_game(game_data: GameCreate, db: Session = Depends(get_db)):
    """創建新遊戲房間"""
    game = Game(
        mode=game_data.mode,
        player_count=game_data.player_count,
        status=GameStatus.WAITING
    )
    db.add(game)
    db.commit()
    db.refresh(game)

    # 創建玩家
    for i in range(game_data.player_count):
        player = Player(
            game_id=game.id,
            order=i
        )
        db.add(player)

    db.commit()
    db.refresh(game)

    return game


@router.get("/{game_id}", response_model=GameState)
async def get_game_state(game_id: str, db: Session = Depends(get_db)):
    """獲取遊戲狀態（輪詢用）"""
    game = db.query(Game).filter(Game.id == game_id).first()
    if not game:
        raise HTTPException(status_code=404, detail="遊戲不存在")
    return game


@router.post("/{game_id}/start")
async def start_game(game_id: str, db: Session = Depends(get_db)):
    """開始遊戲"""
    game = db.query(Game).filter(Game.id == game_id).first()
    if not game:
        raise HTTPException(status_code=404, detail="遊戲不存在")

    if game.status != GameStatus.WAITING:
        raise HTTPException(status_code=400, detail="遊戲已開始")

    game.status = GameStatus.PLAYING
    db.commit()

    return {"message": "遊戲開始", "game_id": game_id}


@router.post("/{game_id}/roll", response_model=RollDiceResponse)
async def roll_dice(game_id: str, db: Session = Depends(get_db)):
    """擲骰子"""
    game = db.query(Game).filter(Game.id == game_id).first()
    if not game:
        raise HTTPException(status_code=404, detail="遊戲不存在")

    if game.status != GameStatus.PLAYING:
        raise HTTPException(status_code=400, detail="遊戲尚未開始")

    # 使用骰子引擎
    result = DiceEngine.roll(game.mode)
    return result


@router.post("/{game_id}/next-turn")
async def next_turn(game_id: str, db: Session = Depends(get_db)):
    """下一位玩家"""
    game = db.query(Game).filter(Game.id == game_id).first()
    if not game:
        raise HTTPException(status_code=404, detail="遊戲不存在")

    # 切換到下一位玩家
    game.current_player_index = (game.current_player_index + 1) % game.player_count

    # 如果回到第一位玩家，回合數+1
    if game.current_player_index == 0:
        game.current_round += 1

    db.commit()

    return {
        "current_player_index": game.current_player_index,
        "current_round": game.current_round
    }


@router.post("/{game_id}/add-drink")
async def add_drink_to_stack(request: AddDrinkRequest, db: Session = Depends(get_db)):
    """加一種顏色到酒堆疊"""
    game = db.query(Game).filter(Game.id == request.game_id).first()
    if not game:
        raise HTTPException(status_code=404, detail="遊戲不存在")

    drink = DrinkStack(
        game_id=request.game_id,
        color=request.color
    )
    db.add(drink)
    db.commit()

    return {"message": f"已加入 {request.color.value} 色酒"}


@router.post("/{game_id}/update-score")
async def update_score(
    game_id: str,
    request: UpdateScoreRequest,
    db: Session = Depends(get_db)
):
    """更新玩家積分"""
    game = db.query(Game).filter(Game.id == game_id).first()
    if not game:
        raise HTTPException(status_code=404, detail="遊戲不存在")

    # 驗證玩家索引
    if request.player_index < 0 or request.player_index >= game.player_count:
        raise HTTPException(status_code=400, detail="無效的玩家索引")

    # 獲取玩家並更新分數
    players = db.query(Player).filter(Player.game_id == game_id).order_by(Player.order).all()

    if request.player_index >= len(players):
        raise HTTPException(status_code=400, detail="玩家不存在")

    player = players[request.player_index]
    player.score += request.delta
    db.commit()

    return {
        "message": "積分更新成功",
        "player_id": player.id,
        "new_score": player.score
    }


@router.post("/{game_id}/reset-base", response_model=ResetBaseResponse)
async def reset_base_drink(game_id: str, db: Session = Depends(get_db)):
    """重置基底酒並清空酒堆疊"""
    game = db.query(Game).filter(Game.id == game_id).first()
    if not game:
        raise HTTPException(status_code=404, detail="遊戲不存在")

    # 清空酒堆疊
    db.query(DrinkStack).filter(DrinkStack.game_id == game_id).delete()

    # 隨機選擇新基底酒
    colors = [DrinkColor.RED, DrinkColor.BLUE, DrinkColor.YELLOW]
    new_base = random.choice(colors)
    game.base_drink = new_base.value

    db.commit()

    return {
        "message": "基底酒已重置",
        "new_base_drink": new_base
    }
