from sqlalchemy import Column, Integer, String, Float, DateTime, JSON
from database import Base
from datetime import datetime


class Game(Base):
    __tablename__ = "games"

    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    player_name = Column(String, nullable=True)  # 本局玩家名（赌王榜用）
    mode = Column(String, default="normal")  # normal / super(超级福利)
    player_case = Column(Integer)
    player_case_value = Column(Float)
    final_result = Column(String)  # "deal" or "no_deal" or "ongoing"
    final_offer = Column(Float, nullable=True)
    final_winnings = Column(Float, nullable=True)
    profit = Column(Float, nullable=True)


class Round(Base):
    __tablename__ = "rounds"

    id = Column(Integer, primary_key=True, index=True)
    game_id = Column(Integer, index=True)
    round_number = Column(Integer)
    remaining_values = Column(JSON)
    opened_cases = Column(JSON)
    banker_offer = Column(Float)
    offer_reason = Column(String, nullable=True)  # 银行家的定价理由
    player_decision = Column(String, nullable=True)  # "deal", "no_deal"


class Wallet(Base):
    __tablename__ = "wallet"

    id = Column(Integer, primary_key=True)
    balance = Column(Float, default=1000000)
