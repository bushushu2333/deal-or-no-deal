import random
from dataclasses import dataclass, field
from typing import Optional


CASE_VALUES = [
    0.01, 1, 5, 10, 25, 50, 75, 100,
    200, 300, 400, 500, 750, 1000, 5000, 10000,
    25000, 50000, 75000, 100000, 200000, 300000, 400000, 500000, 750000, 1000000
]

ROUNDS = [6, 5, 4, 3, 2, 1, 1, 1, 1]  # How many cases to open each round

ENTRY_FEE = 80000        # 普通模式入场券
SUPER_ENTRY_FEE = 200000  # 超级福利模式入场券
INITIAL_BALANCE = 1000000  # 每个账户初始资金

# 超级福利模式：所有 10 万及以上的箱子全部变成 100 万（19 个小数字 + 7 个百万箱）
SUPER_CASE_VALUES = [1000000 if v >= 100000 else v for v in CASE_VALUES]

MODE_CONFIG = {
    "normal": {"entry_fee": ENTRY_FEE, "values": CASE_VALUES},
    "super": {"entry_fee": SUPER_ENTRY_FEE, "values": SUPER_CASE_VALUES},
}


@dataclass
class GameState:
    game_id: int
    mode: str = "normal"               # normal / super(超级福利)
    entry_fee: float = ENTRY_FEE
    player_case: Optional[int] = None
    player_case_value: Optional[float] = None
    remaining_cases: dict[int, float] = field(default_factory=dict)
    opened_cases: list[dict] = field(default_factory=list)
    round_number: int = 0
    offer: Optional[float] = None
    offer_reason: Optional[str] = None
    status: str = "choosing"  # choosing(选命运箱), selecting(开箱), offering, finished
    final_result: Optional[str] = None
    final_winnings: Optional[float] = None
    profit: Optional[float] = None
    # 一次性特权
    free_offer_used: bool = False      # 主动求购（随时卖箱子）已用
    counter_used: bool = False         # 还价已用
    offer_is_midround: bool = False    # 当前报价是主动求购来的（NoDeal后不加轮）
    prev_offer: Optional[float] = None  # 还价前的原价（前端划线展示）

    def __post_init__(self):
        if not self.remaining_cases:
            self.remaining_cases = {i: v for i, v in enumerate(CASE_VALUES)}

    @property
    def remaining_values(self) -> list[float]:
        return list(self.remaining_cases.values())

    def select_case(self, case_index: int):
        if self.status != "choosing":
            raise ValueError("Not in case-choosing phase")
        if case_index not in self.remaining_cases:
            raise ValueError("Invalid case")
        self.player_case = case_index
        self.player_case_value = self.remaining_cases.pop(case_index)
        self.status = "selecting"

    def open_case(self, case_index: int):
        if self.status != "selecting":
            raise ValueError("Not in case-opening phase")
        if case_index not in self.remaining_cases:
            raise ValueError("Case already opened or invalid")
        value = self.remaining_cases.pop(case_index)
        self.opened_cases.append({"case": case_index, "value": value})
        return value

    def compute_expected_value(self) -> float:
        values = self.remaining_values + ([self.player_case_value] if self.player_case_value is not None else [])
        return sum(values) / len(values) if values else 0

    def accept_offer(self):
        self.final_result = "deal"
        self.final_winnings = self.offer
        self.profit = self.final_winnings - self.entry_fee
        self.status = "finished"

    def finish_no_deal(self):
        self.final_result = "no_deal"
        self.final_winnings = self.player_case_value
        self.profit = self.final_winnings - self.entry_fee
        self.status = "finished"


def create_game(game_id: int, mode: str = "normal") -> GameState:
    cfg = MODE_CONFIG.get(mode, MODE_CONFIG["normal"])
    values = cfg["values"].copy()
    random.shuffle(values)
    remaining = {i: v for i, v in enumerate(values)}
    return GameState(game_id=game_id, mode=mode, entry_fee=cfg["entry_fee"], remaining_cases=remaining)
