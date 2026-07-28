import os
import json
import httpx
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv("GLM_API_KEY", "")
BASE_URL = os.getenv("GLM_BASE_URL", "https://aigw.telecomjs.com/v1")
MODEL = os.getenv("GLM_MODEL", "glm-5.2")

SYSTEM = "You are a ruthless capitalist banker in Deal or No Deal. 你的中文分析永远严肃冷酷、不超过50字。"


def _clamp_reason(reason: str) -> str:
    reason = str(reason or "").strip()
    if not reason:
        reason = "基于剩余牌面期望价值与风险折价综合定价。"
    # 硬性截断到50字，优先在句号/逗号处收尾
    if len(reason) > 50:
        cut = max(reason.rfind('。', 0, 50), reason.rfind('，', 0, 50))
        reason = reason[:cut + 1] if cut > 20 else reason[:50]
    return reason


def _call_glm(prompt: str) -> dict:
    """调 GLM 并解析 JSON 响应，异常向上抛"""
    # trust_env=False: 不走系统代理，天翼云内网接口直连
    with httpx.Client(trust_env=False, timeout=30.0) as client:
        response = client.post(
            f"{BASE_URL}/chat/completions",
            headers={
                "Authorization": f"Bearer {API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": MODEL,
                "messages": [
                    {"role": "system", "content": SYSTEM},
                    {"role": "user", "content": prompt},
                ],
                "temperature": 0.7,
                "max_completion_tokens": 512,
            },
        )
    response.raise_for_status()
    content = response.json()["choices"][0]["message"]["content"]

    # Try to parse JSON directly; sometimes the model wraps it in markdown
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        cleaned = content.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("```")[1]
            if cleaned.startswith("json"):
                cleaned = cleaned[4:]
        return json.loads(cleaned.strip())


def _fallback(round_number: int, remaining_values: list[float]) -> dict:
    """本地算法兜底：报价 + 模板理由"""
    if remaining_values:
        expected = sum(remaining_values) / len(remaining_values)
    else:
        expected = 0
    ratio = 0.6 + min(round_number * 0.04, 0.2)
    offer = max(1, int(expected * ratio))
    reason = f"剩余{len(remaining_values)}箱均值{expected:,.0f}美元，按{int(ratio * 100)}%风险折价定价。"
    return {"offer": offer, "reason": reason}


def get_banker_offer(round_number: int, remaining_values: list[float], opened_values: list[float]) -> dict:
    """Call GLM-5.2 to make a banker offer. Returns {"offer": int, "reason": str}"""
    prompt = f"""You are the Banker in the TV game "Deal or No Deal".

There are 26 briefcases with prize amounts. The player has already picked their own briefcase.
You must make an offer to buy the player's briefcase based on the remaining unopened briefcases.

Rules for a good Banker offer:
- The offer should be lower than the expected value of the remaining cases, to make a profit for the house.
- As the game progresses and high-value cases are eliminated, the offer should increase relative to expected value.
- The offer should be a whole dollar amount (no cents).

Output ONLY a JSON object with two keys:
- "offer": integer, your offer in dollars
- "reason": 一段不超过50个字的中文分析，语气严肃冷酷，简要说明你的定价依据（如剩余大奖分布、期望价值、风险折价），不要寒暄

Round: {round_number}
Remaining unopened case values: {remaining_values}
Already opened case values: {opened_values}

Respond with JSON only."""

    try:
        parsed = _call_glm(prompt)
        offer = max(int(parsed.get("offer", 0)), 0)
        if offer <= 0:
            return _fallback(round_number, remaining_values)
        return {"offer": offer, "reason": _clamp_reason(parsed.get("reason"))}
    except Exception:
        return _fallback(round_number, remaining_values)


def get_counter_offer(current_offer: float, round_number: int, remaining_values: list[float], opened_values: list[float], max_possible: float) -> dict:
    """玩家还价一次：GLM 重新报价（必须加价）。Returns {"offer": int, "reason": str}"""
    prompt = f"""You are the Banker in the TV game "Deal or No Deal".

The player has just REJECTED your offer and is demanding a higher price. This is a one-time counter-offer.

Your current offer on the table: ${current_offer:,.0f}
Round: {round_number}
Remaining unopened case values: {remaining_values}
Already opened case values: {opened_values}

Rules:
- You may raise the offer somewhat to close the deal, but stay profitable — never exceed the maximum possible prize (${max_possible:,.0f}).
- A small raise (5%-25%) is typical; if your last offer was already generous, raise less.
- The offer must be a whole dollar amount and HIGHER than ${current_offer:,.0f}.

Output ONLY a JSON object with two keys:
- "offer": integer, your revised offer in dollars
- "reason": 一段不超过50个字的中文回应，语气严肃冷酷，解释你为什么愿意（或只愿意小幅）加价

Respond with JSON only."""

    floor = int(current_offer) + 1
    cap = max(int(max_possible * 0.98), floor)
    try:
        parsed = _call_glm(prompt)
        offer = max(int(parsed.get("offer", 0)), 0)
        # 必须比原价高、不能超过上限；越界则夹回合理区间
        if offer < floor or offer > cap:
            offer = min(max(int(current_offer * 1.1), floor), cap)
        return {"offer": offer, "reason": _clamp_reason(parsed.get("reason"))}
    except Exception:
        offer = min(max(int(current_offer * 1.1), floor), cap)
        return {"offer": offer, "reason": "看你有点胆色，加一成。这是底线，不要得寸进尺。"}
