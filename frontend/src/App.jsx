import { useEffect, useRef, useState } from 'react'
import './index.css'
import Host from './components/Host'
import DialogBox from './components/DialogBox'
import CaseGrid from './components/CaseGrid'
import MoneyBoard from './components/MoneyBoard'
import BankerOffer from './components/BankerOffer'
import GameHistory from './components/GameHistory'
import { ENTRY_FEE, SUPER_ENTRY_FEE, boardValues, modeEntryFee, formatMoney } from './constants'
import { startBGM, setIntensity, sting, tickReveal, setMuted } from './audio/bgm'

const API_BASE = 'http://localhost:8000/api'
const OFFER_DELAY_MS = 4500   // 银行家出价前的悬念时间
const OPEN_ANIM_MS = 750      // 开箱动画时长（动画放完才请求后端）

// 规则讲解页（开局前主持人逐页讲）
const RULES = [
  '欢迎来到《一掷千金》！我是主持人金姐。开赌之前，先听我把规则讲完。',
  '舞台上有 26 个金色手提箱，分别装着 $0.01 到 $1,000,000 的奖金。开局第一件事：你亲自挑一个箱子，作为你的「命运之箱」——它最后装多少，你就可能带走多少。',
  '之后每一轮，你要亲手打开指定数量的其他箱子，开出的金额立即出局。记住：小数字出局是好事，大奖一定要留到最后！',
  '每轮结束，楼上的银行家会打来电话，出价买断你的命运之箱。选 DEAL，拿钱走人；选 NO DEAL，就继续赌下去。他是 GLM-5.2，一个冷酷的资本家，别指望他心软。',
  '你手里还攥着两个一次性特权：一，随时主动喊银行家出价一次——不用等轮末；二，还价一次——嫌他出价低，就逼他加价。都只有一次，用在刀刃上！',
  `最后说钱：你的账户初始有 $1,000,000。两种玩法：普通模式入场券 ${formatMoney(ENTRY_FEE)}，经典 26 箱；超级福利模式入场券 ${formatMoney(SUPER_ENTRY_FEE)}，场上 7 个箱子全是百万大奖！游戏结束，你带走的奖金会打进账户。盈亏 = 带走的奖金 − 入场券。听懂了就上台吧！`,
]

// 主持人台词
const LINES = {
  choose: '入场券已收。现在，凭你的直觉，从 26 个箱子里选一个——它就是你的命运之箱！',
  intro: (n) => `好，#${n + 1} 号箱归你了，先锁到保险柜里。第一轮，请打开 6 个箱子——祈祷别开出大数字！`,
  bigOut: (v) => `天哪…… ${formatMoney(v)} 没了！观众席一片叹息。深呼吸，继续！`,
  midOut: (v) => `${formatMoney(v)} 出局。不好不坏，场面还很胶着……`,
  smallOut: (v) => `漂亮！只损失了 ${formatMoney(v)}！大奖还活着，全场为你欢呼！`,
  noDeal: (round) => `NO DEAL！你有胆量！比赛继续，第 ${round + 1} 轮，开箱子吧！`,
  dealDone: (w, p, cv) => {
    const diff = w - cv
    const verdict = diff >= 0
      ? `卖得好！箱子里还没这单多，净赚 ${formatMoney(diff)}！`
      : `嘶……不卖的话能多拿 ${formatMoney(-diff)}，血亏！`
    return `成交！你带着 ${formatMoney(w)} 离开舞台，盈亏 ${formatMoney(p)}。现在揭晓——你的命运之箱里装的是 ${formatMoney(cv)}！${verdict}`
  },
  finishNoDeal: (w, p) => `命运之箱，揭晓——${formatMoney(w)}！扣除入场券，盈亏 ${formatMoney(p)}。${p >= 0 ? '恭喜，满载而归！' : '可惜，这就是赌博！'}`,
  welcomeBack: (b, fee) => `欢迎回到《一掷千金》！账户余额 ${formatMoney(b)}，当前模式入场券 ${formatMoney(fee)} 一局。今晚手气如何？`,
  broke: '哎呀……你的账户连当前模式的入场券都不够了。银行家表示很遗憾。要不，给你重置到 $1,000,000 东山再起？',
}

// 报价前主持人的牌面分析
function hostAnalysis(game) {
  // 按次数扣：福利模式有 7 个 $1.00M，开掉一个只扣一个
  const counts = {}
  game.opened_cases.forEach((o) => { counts[o.value] = (counts[o.value] || 0) + 1 })
  const alive = [] // 含命运之箱（未知），都算"在场上"
  boardValues(game.mode).forEach((v) => {
    if ((counts[v] || 0) > 0) counts[v] -= 1
    else alive.push(v)
  })
  const ev = alive.reduce((a, b) => a + b, 0) / alive.length
  const big = alive.filter((v) => v >= 100000)
  let mood
  if (!alive.includes(1000000)) {
    mood = '百万大奖已经出局，银行家在电话那头估计笑出了声。'
  } else if (big.length >= 5) {
    mood = `百万大奖还活着，${big.length} 个十万级大奖全留在场上，银行家这次恐怕要出血。`
  } else if (big.length >= 2) {
    mood = `场上还剩 ${big.length} 个十万级大奖，局势很微妙。`
  } else {
    mood = '大奖基本出局了，这次报价恐怕不会好看……'
  }
  return `我帮你看了下牌面：场上还有 ${alive.length} 个金额没出局，期望价值约 ${formatMoney(ev)}。${mood}嘘——电话来了，银行家正在评估牌面，等他出价。`
}

function App() {
  const [game, setGame] = useState(null)
  const [loading, setLoading] = useState(false)
  const [dialog, setDialog] = useState('')
  const [hostExpr, setHostExpr] = useState('normal')
  const [historyOpen, setHistoryOpen] = useState(false)
  const [balance, setBalance] = useState(null)
  const [rulesStep, setRulesStep] = useState(null) // null=不在讲规则
  const [rulesSeen, setRulesSeen] = useState(false)
  const [offerRevealed, setOfferRevealed] = useState(false)
  const [openingCase, setOpeningCase] = useState(null)
  const [reveal, setReveal] = useState(null)
  const [muted, setMutedState] = useState(false)
  const [playerName, setPlayerName] = useState(() => localStorage.getItem('dnd_player_name') || '')
  const [mode, setMode] = useState(() => localStorage.getItem('dnd_mode') || 'normal')
  const prevRef = useRef(null)
  const offerTimerRef = useRef(null)

  const fee = game?.entry_fee ?? modeEntryFee(mode)
  const broke = balance !== null && balance < fee && !game

  // 初始化：拉钱包；?play=1 直接进规则/开局
  useEffect(() => {
    fetch(`${API_BASE}/wallet`).then((r) => r.json()).then((w) => {
      setBalance(w.balance)
      if (w.balance < ENTRY_FEE) {
        setDialog(LINES.broke)
      } else if (window.location.search.includes('play=1')) {
        setRulesStep(0)
      } else {
        setRulesStep(0) // 首次来一律先讲规则
      }
    }).catch(() => setDialog('后台服务连不上……检查一下后端是不是在跑？'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 规则翻页时更新台词
  useEffect(() => {
    if (rulesStep !== null) setDialog(RULES[rulesStep])
  }, [rulesStep])

  // 根据游戏状态变化推台词、表情、报价悬念
  useEffect(() => {
    const prev = prevRef.current
    prevRef.current = game
    if (!game) return
    if (game.balance !== undefined && game.balance !== null) setBalance(game.balance)

    if (!prev) {
      if (game.status === 'choosing') setDialog(LINES.choose)
      setHostExpr('normal')
      return
    }

    if (game.status === 'finished') {
      clearTimeout(offerTimerRef.current)
      setOfferRevealed(false)
      setIntensity(0)
      setHostExpr('excited')
      setDialog(game.final_result === 'deal'
        ? LINES.dealDone(game.final_winnings, game.profit, game.player_case_value)
        : LINES.finishNoDeal(game.final_winnings, game.profit))
      return
    }

    if (prev.status === 'choosing' && game.status === 'selecting') {
      setDialog(LINES.intro(game.player_case))
      setHostExpr('normal')
      return
    }

    if (game.status === 'offering' && prev.status !== 'offering') {
      setHostExpr('thinking')
      setDialog(hostAnalysis(game))
      setOfferRevealed(false)
      setIntensity(1) // BGM 进入悬念档
      clearTimeout(offerTimerRef.current)
      offerTimerRef.current = setTimeout(() => {
        setOfferRevealed(true)
        sting() // 报价揭晓 sting
      }, OFFER_DELAY_MS)
      return
    }

    if (prev.status === 'offering' && game.status === 'selecting') {
      setHostExpr('excited')
      setIntensity(0)
      setDialog(LINES.noDeal(game.round_number))
      return
    }

    if (game.opened_cases.length > prev.opened_cases.length) {
      const last = game.opened_cases[game.opened_cases.length - 1]
      const v = last.value
      if (v >= 100000) {
        setHostExpr('normal')
        setDialog(LINES.bigOut(v))
      } else if (v >= 10000) {
        setHostExpr('normal')
        setDialog(LINES.midOut(v))
      } else {
        setHostExpr('excited')
        setDialog(LINES.smallOut(v))
      }
    }
  }, [game])

  const startGame = async () => {
    setLoading(true)
    startBGM() // 用户手势内启动 BGM（浏览器自动播放限制）
    try {
      const name = playerName.trim()
      localStorage.setItem('dnd_player_name', name)
      localStorage.setItem('dnd_mode', mode)
      const res = await fetch(`${API_BASE}/games`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player_name: name, mode }),
      })
      const data = await res.json()
      if (!res.ok) {
        setDialog(data.detail || '开局失败')
        if (data.detail?.includes('余额不足')) setBalance((b) => b) // 触发 broke 显示
        const w = await fetch(`${API_BASE}/wallet`).then((r) => r.json())
        setBalance(w.balance)
        setLoading(false)
        return
      }
      const statusData = await fetch(`${API_BASE}/games/${data.game_id}`).then((r) => r.json())
      prevRef.current = null
      setRulesSeen(true)
      setRulesStep(null)
      setGame(statusData)
    } catch (err) {
      setDialog('后台服务连不上……检查一下后端是不是在跑？')
    }
    setLoading(false)
  }

  const selectCase = async (caseIndex) => {
    if (!game || loading) return
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/games/select_case`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game_id: game.game_id, case_index: caseIndex }),
      })
      setGame(await res.json())
    } catch (err) {
      setDialog('网络抖了一下，再点一次试试？')
    }
    setLoading(false)
  }

  const openCase = (caseIndex) => {
    if (!game || loading || openingCase !== null) return
    setOpeningCase(caseIndex)
    setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/games/open`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ game_id: game.game_id, case_index: caseIndex }),
        })
        const data = await res.json()
        setGame(data)
        const last = data.opened_cases?.[data.opened_cases.length - 1]
        if (last) {
          tickReveal() // 揭晓音效
          setReveal(last)
          setTimeout(() => setReveal(null), 1600)
        }
      } catch (err) {
        setDialog('网络抖了一下，再点一次试试？')
      }
      setOpeningCase(null)
    }, OPEN_ANIM_MS)
  }

  const makeDecision = async (decision) => {
    if (!game || loading) return
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/games/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game_id: game.game_id, decision }),
      })
      setGame(await res.json())
    } catch (err) {
      setDialog('网络抖了一下，再试一次？')
    }
    setLoading(false)
  }

  // 一次性特权：随时喊银行家出价
  const askOffer = async () => {
    if (!game || loading) return
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/games/ask_offer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game_id: game.game_id }),
      })
      const data = await res.json()
      if (!res.ok) setDialog(data.detail || '求购失败')
      else setGame(data)
    } catch (err) {
      setDialog('网络抖了一下，再试一次？')
    }
    setLoading(false)
  }

  // 一次性特权：还价
  const counterOffer = async () => {
    if (!game || loading) return
    setLoading(true)
    setDialog('你跟银行家讨价还价……他沉默了。')
    try {
      const res = await fetch(`${API_BASE}/games/counter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game_id: game.game_id }),
      })
      const data = await res.json()
      if (!res.ok) setDialog(data.detail || '还价失败')
      else {
        setGame(data)
        sting() // 新报价揭晓 sting
        setDialog('银行家让步了——这可是他最后的底线！')
      }
    } catch (err) {
      setDialog('网络抖了一下，再试一次？')
    }
    setLoading(false)
  }

  const toggleMute = () => {
    setMutedState((m) => {
      setMuted(!m)
      return !m
    })
  }

  const resetWallet = async () => {
    const w = await fetch(`${API_BASE}/wallet/reset`, { method: 'POST' }).then((r) => r.json())
    setBalance(w.balance)
    setDialog(LINES.welcomeBack(w.balance, fee))
    setHostExpr('excited')
  }

  const restart = () => {
    setGame(null)
    prevRef.current = null
    setOfferRevealed(false)
    setHostExpr('normal')
    if (balance !== null && balance < fee) {
      setDialog(LINES.broke)
    } else {
      setDialog(LINES.welcomeBack(balance, fee))
    }
  }

  const inRules = rulesStep !== null && !game

  // 模式选择（普通 / 超级福利）
  const modeSelector = (
    <div className="flex rounded-full overflow-hidden border border-amber-500/40">
      <button
        onClick={() => setMode('normal')}
        className={`px-5 py-2.5 text-sm font-bold transition ${mode === 'normal' ? 'bg-amber-400 text-amber-950' : 'bg-black/50 text-amber-200/70 hover:text-amber-200'}`}
      >
        普通模式 {formatMoney(ENTRY_FEE)}
      </button>
      <button
        onClick={() => setMode('super')}
        className={`px-5 py-2.5 text-sm font-bold transition ${mode === 'super' ? 'bg-red-500 text-white' : 'bg-black/50 text-amber-200/70 hover:text-amber-200'}`}
      >
        🎁 超级福利 {formatMoney(SUPER_ENTRY_FEE)}
      </button>
    </div>
  )

  // 玩家名字输入（上赌王榜用，记住上次填的）
  const nameInput = (
    <input
      value={playerName}
      onChange={(e) => setPlayerName(e.target.value)}
      maxLength={20}
      placeholder="你的名字（留空=神秘赌客）"
      className="bg-black/50 border border-amber-500/40 rounded-full px-5 py-2.5 text-amber-100 placeholder-amber-200/40 text-center outline-none focus:border-amber-400 w-64"
    />
  )

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* 舞台背景 */}
      <div className="stage-bg">
        <img src="/assets/stage_bg.png" alt="" onError={(e) => (e.target.style.display = 'none')} />
      </div>
      <div className="stage-vignette" />

      {/* 顶栏 */}
      <header className="relative z-10 flex items-center justify-between px-4 md:px-8 pt-4">
        <h1 className="text-xl md:text-3xl font-black text-amber-400 tracking-wider drop-shadow-[0_0_12px_rgba(245,194,66,0.6)]">
          一掷千金 <span className="text-amber-100/60 text-sm md:text-base font-normal">Deal or No Deal</span>
        </h1>
        <div className="flex items-center gap-3">
          {game?.mode === 'super' && (
            <span className="text-white font-bold text-sm bg-red-500/80 border border-red-300/50 rounded-full px-4 py-1.5 backdrop-blur animate-pulse">
              🎁 超级福利场
            </span>
          )}
          {balance !== null && (
            <span className="text-amber-300 font-bold font-mono text-sm md:text-lg bg-black/40 border border-amber-500/40 rounded-full px-4 py-1.5 backdrop-blur">
              💰 {formatMoney(balance)}
            </span>
          )}
          <button
            onClick={toggleMute}
            title={muted ? '打开音乐' : '静音'}
            className="text-amber-200/80 hover:text-amber-200 border border-amber-500/40 rounded-full px-3 py-1.5 text-sm bg-black/40 backdrop-blur"
          >
            {muted ? '🔇' : '🔊'}
          </button>
          <button
            onClick={() => setHistoryOpen(true)}
            className="text-amber-200/80 hover:text-amber-200 border border-amber-500/40 rounded-full px-4 py-1.5 text-sm bg-black/40 backdrop-blur"
          >
            历史战绩
          </button>
        </div>
      </header>

      {/* 银行家评估中横幅（报价前的悬念） */}
      {game?.status === 'offering' && !offerRevealed && (
        <div className="fixed top-16 md:top-20 inset-x-0 z-20 flex justify-center pointer-events-none">
          <div className="pop-in flex items-center gap-3 bg-black/70 border border-amber-500/50 rounded-full px-6 py-2.5 backdrop-blur">
            <span className="text-2xl phone-ring inline-block">☎️</span>
            <span className="text-amber-200 tracking-widest">银行家正在评估牌面……</span>
          </div>
        </div>
      )}

      {/* 主舞台：左奖金榜 + 中央箱子 */}
      <main className="relative z-10 flex items-start justify-center gap-4 px-4 md:px-8 pt-4 md:pt-6 pb-44 md:pb-48">
        {game && <MoneyBoard game={game} />}
        <div className="flex-1 min-w-0 max-w-2xl">
          {game && (
            <CaseGrid
              game={game}
              onOpen={game.status === 'choosing' ? selectCase : openCase}
              loading={loading}
              openingCase={openingCase}
            />
          )}
          {/* 一次性特权：主动求购 */}
          {game?.status === 'selecting' && !game.free_offer_used && game.opened_cases.length > 0 && (
            <div className="text-center mt-5">
              <button
                onClick={askOffer}
                disabled={loading}
                className="border-2 border-amber-400/70 text-amber-300 hover:bg-amber-400/10 font-bold px-6 py-2.5 rounded-full transition disabled:opacity-50 backdrop-blur bg-black/40"
              >
                📞 主动喊银行家出价 <span className="text-sm font-normal text-amber-200/60">（仅 1 次）</span>
              </button>
            </div>
          )}
          {!game && <div className="h-[40vh] md:h-[55vh]" />}
        </div>
        <div className="hidden lg:block w-32 xl:w-40 shrink-0" />
      </main>

      {/* 开箱金额揭晓弹字 */}
      {reveal && (
        <div className="fixed inset-0 z-30 flex items-center justify-center pointer-events-none">
          <div className={`reveal-pop text-center font-black ${reveal.value >= 100000 ? 'text-red-400' : reveal.value >= 10000 ? 'text-amber-300' : 'text-green-400'}`}>
            <div className="text-6xl md:text-8xl drop-shadow-[0_0_25px_rgba(0,0,0,0.9)]">{formatMoney(reveal.value)}</div>
            <div className="text-xl md:text-2xl text-white/85 mt-2 tracking-widest">出局</div>
          </div>
        </div>
      )}

      {/* 加载中转圈（GLM 思考时的卡点提示） */}
      {loading && game && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="flex flex-col items-center gap-3 bg-black/60 rounded-2xl px-8 py-6 backdrop-blur">
            <div className="loader-ring" />
            <span className="text-amber-200 tracking-widest text-sm">加载中……</span>
          </div>
        </div>
      )}

      {/* 主持人立绘 */}
      <Host expression={hostExpr} />

      {/* 橙光对话框 */}
      <DialogBox text={dialog} loading={loading}>
        {inRules && rulesStep < RULES.length - 1 && (
          <button onClick={() => setRulesStep(rulesStep + 1)} className="btn-gold font-bold text-lg px-8 py-2.5 rounded-full">
            继续 →
          </button>
        )}
        {inRules && rulesStep === RULES.length - 1 && (
          <>
            {modeSelector}
            {nameInput}
            <button onClick={startGame} disabled={loading || broke} className="btn-gold font-black text-lg px-8 py-2.5 rounded-full disabled:opacity-50">
              {loading ? '准备中…' : `支付 ${formatMoney(fee)} 入场券，上台！`}
            </button>
          </>
        )}
        {!game && !inRules && !broke && (
          <>
            {modeSelector}
            {nameInput}
            <button onClick={startGame} disabled={loading} className="btn-gold font-black text-lg px-8 py-2.5 rounded-full disabled:opacity-50">
              {loading ? '准备中…' : `再来一局（${formatMoney(fee)}）`}
            </button>
            <button onClick={() => setRulesStep(0)} className="text-amber-200/70 hover:text-amber-200 border border-amber-500/40 rounded-full px-5 py-2.5">
              重听规则
            </button>
          </>
        )}
        {broke && (
          <button onClick={resetWallet} className="btn-gold font-black text-lg px-8 py-2.5 rounded-full">
            重置账户到 $1.00M
          </button>
        )}
        {game?.status === 'finished' && (
          <button onClick={restart} className="btn-gold font-black text-lg px-8 py-2.5 rounded-full">
            再玩一局
          </button>
        )}
      </DialogBox>

      {/* 银行家报价 / 结算（报价要等悬念时间结束才显示） */}
      {game && (
        <BankerOffer
          game={game}
          visible={game.status !== 'offering' || offerRevealed}
          onDecision={makeDecision}
          onCounter={counterOffer}
          onRestart={restart}
          loading={loading}
        />
      )}

      {/* 历史抽屉 */}
      <GameHistory open={historyOpen} onClose={() => setHistoryOpen(false)} />
    </div>
  )
}

export default App
