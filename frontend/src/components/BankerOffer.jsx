import { useState } from 'react'
import { ENTRY_FEE, formatMoney } from '../constants'

function BankerOffer({ game, visible, onDecision, onCounter, onRestart, loading }) {
  const [dismissed, setDismissed] = useState(false)
  const isOffering = game.status === 'offering' && game.offer !== null
  const isFinished = game.status === 'finished'
  if (!isOffering && !isFinished) {
    if (dismissed) setDismissed(false) // 下一局重置
    return null
  }
  if (isOffering && !visible) return null // 报价前的悬念时间
  if (isFinished && dismissed) return null // 关掉结算看盘面

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 backdrop-blur-sm fade-in px-4">
      {isOffering && (
        <div key={game.offer} className="pop-in text-center bg-gradient-to-b from-[#2a1016] to-[#12060a] border border-amber-500/40 rounded-3xl px-8 py-10 md:px-14 shadow-2xl max-w-lg w-full">
          <div className="text-6xl mb-4 phone-ring inline-block">☎️</div>
          <div className="text-amber-200/80 tracking-widest mb-2">
            银行家 出价{game.offer_is_midround && <span className="ml-2 text-xs border border-amber-500/50 rounded-full px-2 py-0.5">你的主动求购</span>}
          </div>
          {game.prev_offer != null && (
            <div className="text-amber-200/50 line-through font-mono text-xl">原价 {formatMoney(game.prev_offer)}</div>
          )}
          <div className="offer-glow text-5xl md:text-6xl font-black text-amber-400 mb-4 font-mono">
            {formatMoney(game.offer)}
          </div>
          {game.offer_reason && (
            <div className="text-left text-amber-100/80 text-sm md:text-base border border-amber-500/25 rounded-xl px-4 py-3 bg-black/30 mb-6">
              <span className="font-bold text-amber-300">银行家：</span>
              <span className="font-serif">「{game.offer_reason}」</span>
            </div>
          )}
          <div className="flex gap-4 justify-center">
            <button
              onClick={() => onDecision('deal')}
              disabled={loading}
              className="btn-deal text-white font-black text-xl md:text-2xl px-8 py-4 rounded-2xl disabled:opacity-50"
            >
              DEAL<br /><span className="text-sm font-normal">成交</span>
            </button>
            <button
              onClick={() => onDecision('no_deal')}
              disabled={loading}
              className="btn-nodeal text-white font-black text-xl md:text-2xl px-8 py-4 rounded-2xl disabled:opacity-50"
            >
              NO DEAL<br /><span className="text-sm font-normal">{game.offer_is_midround ? '继续开箱' : '继续'}</span>
            </button>
          </div>
          {!game.counter_used && (
            <button
              onClick={onCounter}
              disabled={loading}
              className="mt-4 w-full border-2 border-amber-400/70 text-amber-300 hover:bg-amber-400/10 font-bold text-lg px-6 py-3 rounded-2xl transition disabled:opacity-50"
            >
              🔥 还价一次 <span className="text-sm font-normal text-amber-200/60">（逼银行家加价，仅 1 次）</span>
            </button>
          )}
        </div>
      )}

      {isFinished && (
        <div className="pop-in relative text-center bg-gradient-to-b from-[#2a1016] to-[#12060a] border border-amber-500/40 rounded-3xl px-8 py-10 md:px-14 shadow-2xl max-w-lg w-full">
          <button
            onClick={() => setDismissed(true)}
            title="看看盘面"
            className="absolute top-4 right-5 text-amber-200/50 hover:text-amber-200 text-2xl leading-none"
          >
            ×
          </button>
          <div className="text-amber-200/80 tracking-widest mb-2">
            {game.final_result === 'deal' ? '成交！' : '坚持到底！'}
          </div>
          <div className="offer-glow text-5xl md:text-6xl font-black text-amber-400 mb-4 font-mono">
            {formatMoney(game.final_winnings)}
          </div>

          {/* 命运之箱揭晓 */}
          {game.player_case_value != null && (
            <div className="pop-in text-amber-100/90 text-sm md:text-base border border-amber-400/50 rounded-xl px-4 py-3 bg-amber-500/10 mb-4" style={{ animationDelay: '0.4s' }}>
              <div className="text-lg">
                🔓 你的 #{game.player_case + 1} 号命运之箱，装的是{' '}
                <b className="text-amber-300 font-mono text-xl">{formatMoney(game.player_case_value)}</b>
              </div>
              {game.final_result === 'deal' && (
                <div className={`mt-1 font-bold ${game.final_winnings >= game.player_case_value ? 'text-green-400' : 'text-red-400'}`}>
                  {game.final_winnings >= game.player_case_value
                    ? `卖对了！比箱子里的多拿 ${formatMoney(game.final_winnings - game.player_case_value)}`
                    : `卖亏了……箱子比这单多 ${formatMoney(game.player_case_value - game.final_winnings)}`}
                </div>
              )}
            </div>
          )}

          <div className="text-amber-100/75 text-sm md:text-base border border-amber-500/25 rounded-xl px-4 py-3 bg-black/30 mb-6 space-y-1">
            <div>带走奖金 {formatMoney(game.final_winnings)} − 入场券 {formatMoney(game.entry_fee ?? ENTRY_FEE)}</div>
            <div className={`text-xl font-bold ${(game.profit || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              盈亏 {game.profit >= 0 ? '+' : ''}{formatMoney(game.profit)}
            </div>
            <div className="text-amber-200/70">当前账户余额 {formatMoney(game.balance)}</div>
          </div>
          <button
            onClick={onRestart}
            className="btn-gold font-black text-xl px-10 py-4 rounded-2xl"
          >
            再玩一局
          </button>
        </div>
      )}
    </div>
  )
}

export default BankerOffer
