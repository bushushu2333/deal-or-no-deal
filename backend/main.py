from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from database import engine, Base, get_db
from models import Game as GameModel, Round as RoundModel, Wallet as WalletModel
from game_logic import create_game, GameState, ROUNDS, MODE_CONFIG, ENTRY_FEE, INITIAL_BALANCE
from glm_banker import get_banker_offer, get_counter_offer

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Deal or No Deal")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory store for active games
GAMES: dict[int, GameState] = {}


def get_wallet(db: Session) -> WalletModel:
    w = db.query(WalletModel).first()
    if not w:
        w = WalletModel(balance=INITIAL_BALANCE)
        db.add(w)
        db.commit()
        db.refresh(w)
    return w


class CreateGameRequest(BaseModel):
    player_name: Optional[str] = None
    mode: Optional[str] = "normal"  # normal / super(超级福利)


class CreateGameResponse(BaseModel):
    game_id: int
    remaining_cases: list[int]
    round_number: int
    status: str
    balance: float
    mode: str
    entry_fee: float


class SelectCaseRequest(BaseModel):
    game_id: int
    case_index: int


class OpenCaseRequest(BaseModel):
    game_id: int
    case_index: int


class DecisionRequest(BaseModel):
    game_id: int
    decision: str  # "deal" or "no_deal"


class GameStatus(BaseModel):
    game_id: int
    mode: str = "normal"
    entry_fee: float = ENTRY_FEE
    player_case: Optional[int]
    remaining_cases: list[int]
    opened_cases: list[dict]
    round_number: int
    cases_to_open: int
    offer: Optional[float]
    offer_reason: Optional[str]
    status: str
    final_result: Optional[str]
    final_winnings: Optional[float]
    profit: Optional[float]
    balance: Optional[float]
    # 仅完赛后揭晓：命运之箱金额 + 全盘面内容（防止中途剧透）
    player_case_value: Optional[float] = None
    all_cases: Optional[dict] = None
    # 一次性特权状态
    free_offer_used: bool = False
    counter_used: bool = False
    offer_is_midround: bool = False
    prev_offer: Optional[float] = None


@app.post("/api/games", response_model=CreateGameResponse)
def new_game(req: CreateGameRequest = None, db: Session = Depends(get_db)):
    mode = (req.mode if req else None) or "normal"
    if mode not in MODE_CONFIG:
        raise HTTPException(status_code=400, detail="模式不存在")
    entry_fee = MODE_CONFIG[mode]["entry_fee"]

    wallet = get_wallet(db)
    if wallet.balance < entry_fee:
        raise HTTPException(status_code=400, detail=f"余额不足：入场券需要 ${entry_fee:,}，当前余额 ${wallet.balance:,.0f}")
    wallet.balance -= entry_fee

    player_name = ((req.player_name if req else None) or '').strip()[:20] or '神秘赌客'
    game_db = GameModel(final_result="ongoing", player_name=player_name, mode=mode)
    db.add(game_db)
    db.commit()
    db.refresh(game_db)

    game = create_game(game_db.id, mode)
    GAMES[game_db.id] = game

    return CreateGameResponse(
        game_id=game.game_id,
        remaining_cases=list(game.remaining_cases.keys()),
        round_number=game.round_number,
        status=game.status,
        balance=wallet.balance,
        mode=game.mode,
        entry_fee=game.entry_fee,
    )


@app.get("/api/games/{game_id}", response_model=GameStatus)
def get_status(game_id: int, db: Session = Depends(get_db)):
    game = GAMES.get(game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    return _game_to_status(game, db)


def _game_to_status(game: GameState, db: Session) -> GameStatus:
    # 本轮"还需开"的数量：随开启递减
    if game.round_number < len(ROUNDS):
        opened_this_round = len(game.opened_cases) - sum(ROUNDS[:game.round_number])
        cases_to_open = max(ROUNDS[game.round_number] - opened_this_round, 0)
    else:
        cases_to_open = 0
    finished = game.status == "finished"
    # 完赛后揭晓全盘面：剩余箱子 + 命运之箱
    all_cases = None
    if finished:
        all_cases = dict(game.remaining_cases)
        if game.player_case is not None:
            all_cases[game.player_case] = game.player_case_value
    return GameStatus(
        game_id=game.game_id,
        mode=game.mode,
        entry_fee=game.entry_fee,
        player_case=game.player_case,
        remaining_cases=list(game.remaining_cases.keys()),
        opened_cases=game.opened_cases,
        round_number=game.round_number,
        cases_to_open=cases_to_open,
        offer=game.offer,
        offer_reason=game.offer_reason,
        status=game.status,
        final_result=game.final_result,
        final_winnings=game.final_winnings,
        profit=game.profit,
        balance=get_wallet(db).balance,
        player_case_value=game.player_case_value if finished else None,
        all_cases=all_cases,
        free_offer_used=game.free_offer_used,
        counter_used=game.counter_used,
        offer_is_midround=game.offer_is_midround,
        prev_offer=game.prev_offer,
    )


@app.post("/api/games/select_case", response_model=GameStatus)
def select_case(req: SelectCaseRequest, db: Session = Depends(get_db)):
    game = GAMES.get(req.game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    try:
        game.select_case(req.case_index)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    game_db = db.query(GameModel).filter_by(id=game.game_id).first()
    if game_db:
        game_db.player_case = game.player_case
        game_db.player_case_value = game.player_case_value
        db.commit()

    return _game_to_status(game, db)


@app.post("/api/games/open", response_model=GameStatus)
def open_case(req: OpenCaseRequest, db: Session = Depends(get_db)):
    game = GAMES.get(req.game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    if game.status == "finished":
        raise HTTPException(status_code=400, detail="Game already finished")

    try:
        game.open_case(req.case_index)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Check if round is over (need to offer)
    cases_to_open = ROUNDS[game.round_number] if game.round_number < len(ROUNDS) else 0
    opened_this_round = len(game.opened_cases) - sum(ROUNDS[:game.round_number])

    if opened_this_round >= cases_to_open:
        # Make banker offer
        round_number = game.round_number + 1
        result = get_banker_offer(
            round_number=round_number,
            remaining_values=game.remaining_values,
            opened_values=[o["value"] for o in game.opened_cases],
        )
        game.offer = result["offer"]
        game.offer_reason = result["reason"]
        game.status = "offering"

        round_db = RoundModel(
            game_id=game.game_id,
            round_number=round_number,
            remaining_values=game.remaining_values,
            opened_cases=game.opened_cases,
            banker_offer=game.offer,
            offer_reason=game.offer_reason,
        )
        db.add(round_db)
        db.commit()

    return _game_to_status(game, db)


class AskOfferRequest(BaseModel):
    game_id: int


@app.post("/api/games/ask_offer", response_model=GameStatus)
def ask_offer(req: AskOfferRequest, db: Session = Depends(get_db)):
    """一次性特权：随时喊银行家出价（不打断本轮进度）"""
    game = GAMES.get(req.game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    if game.status != "selecting":
        raise HTTPException(status_code=400, detail="只能在开箱阶段求购")
    if game.free_offer_used:
        raise HTTPException(status_code=400, detail="主动求购机会已用完")

    result = get_banker_offer(
        round_number=game.round_number + 1,
        remaining_values=game.remaining_values,
        opened_values=[o["value"] for o in game.opened_cases],
    )
    game.offer = result["offer"]
    game.offer_reason = result["reason"]
    game.status = "offering"
    game.offer_is_midround = True
    game.free_offer_used = True

    round_db = RoundModel(
        game_id=game.game_id,
        round_number=game.round_number + 1,
        remaining_values=game.remaining_values,
        opened_cases=game.opened_cases,
        banker_offer=game.offer,
        offer_reason=game.offer_reason,
    )
    db.add(round_db)
    db.commit()

    return _game_to_status(game, db)


@app.post("/api/games/counter", response_model=GameStatus)
def counter_offer(req: AskOfferRequest, db: Session = Depends(get_db)):
    """一次性特权：还价，让银行家重新出更高的价"""
    game = GAMES.get(req.game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    if game.status != "offering":
        raise HTTPException(status_code=400, detail="当前没有报价可还")
    if game.counter_used:
        raise HTTPException(status_code=400, detail="还价机会已用完")

    max_possible = max(game.remaining_values + [game.player_case_value])
    result = get_counter_offer(
        current_offer=game.offer,
        round_number=game.round_number + 1,
        remaining_values=game.remaining_values,
        opened_values=[o["value"] for o in game.opened_cases],
        max_possible=max_possible,
    )
    game.prev_offer = game.offer
    game.offer = result["offer"]
    game.offer_reason = result["reason"]
    game.counter_used = True

    round_db = db.query(RoundModel).filter_by(game_id=game.game_id).order_by(RoundModel.id.desc()).first()
    if round_db:
        round_db.banker_offer = game.offer
        round_db.offer_reason = game.offer_reason
        db.commit()

    return _game_to_status(game, db)


@app.post("/api/games/decision", response_model=GameStatus)
def make_decision(req: DecisionRequest, db: Session = Depends(get_db)):
    game = GAMES.get(req.game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    if game.status != "offering":
        raise HTTPException(status_code=400, detail="No offer to decide on")

    round_db = db.query(RoundModel).filter_by(game_id=game.game_id).order_by(RoundModel.id.desc()).first()

    if req.decision == "deal":
        game.accept_offer()
    elif req.decision == "no_deal":
        # 主动求购来的报价：拒绝后回到本轮继续开，不加轮
        if not game.offer_is_midround:
            game.round_number += 1
        game.status = "selecting"
        game.offer = None
        game.offer_reason = None
        game.prev_offer = None
        game.offer_is_midround = False
        # If only player's case left, finish
        if len(game.remaining_cases) == 0:
            game.finish_no_deal()
    else:
        raise HTTPException(status_code=400, detail="Decision must be 'deal' or 'no_deal'")

    if round_db:
        round_db.player_decision = req.decision

    if game.status == "finished":
        # 结算：奖金入钱包
        wallet = get_wallet(db)
        wallet.balance += game.final_winnings or 0

        game_db = db.query(GameModel).filter_by(id=game.game_id).first()
        if game_db:
            game_db.final_result = game.final_result
            game_db.final_offer = game.offer
            game_db.final_winnings = game.final_winnings
            game_db.profit = game.profit
    db.commit()

    return _game_to_status(game, db)


@app.get("/api/wallet")
def wallet_status(db: Session = Depends(get_db)):
    w = get_wallet(db)
    return {
        "balance": w.balance,
        "entry_fee": MODE_CONFIG["normal"]["entry_fee"],
        "super_entry_fee": MODE_CONFIG["super"]["entry_fee"],
        "initial_balance": INITIAL_BALANCE,
    }


@app.post("/api/wallet/reset")
def wallet_reset(db: Session = Depends(get_db)):
    w = get_wallet(db)
    w.balance = INITIAL_BALANCE
    db.commit()
    return {"balance": w.balance}


@app.get("/api/history")
def history(db: Session = Depends(get_db)):
    games = db.query(GameModel).order_by(GameModel.id.desc()).limit(50).all()
    return [
        {
            "id": g.id,
            "created_at": g.created_at.isoformat() if g.created_at else None,
            "player_name": g.player_name or '神秘赌客',
            "mode": g.mode or 'normal',
            "player_case": g.player_case,
            "player_case_value": g.player_case_value,
            "final_result": g.final_result,
            "final_offer": g.final_offer,
            "final_winnings": g.final_winnings,
            "profit": g.profit,
        }
        for g in games
    ]


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
