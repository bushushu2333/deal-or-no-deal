import { formatMoney } from '../constants'

function CaseGrid({ game, onOpen, loading, openingCase }) {
  const allCases = Array.from({ length: 26 }, (_, i) => i)
  const openedMap = new Map(game.opened_cases.map((o) => [o.case, o.value]))
  const isFinished = game.status === 'finished'
  const isOffering = game.status === 'offering'
  const isChoosing = game.status === 'choosing'
  // 完赛后全盘面揭晓
  const revealAll = isFinished && game.all_cases

  const hint = isChoosing
    ? '👆 选一个你的命运之箱'
    : isFinished
      ? '全场揭晓！'
      : isOffering
        ? '银行家出价中……'
        : <>第 {game.round_number + 1} 轮 · 本轮还需开 <b className="text-amber-400 text-lg">{game.cases_to_open}</b> 个箱子</>

  return (
    <div className="fade-in">
      <div className="text-center mb-3">
        <span className="inline-block bg-black/50 border border-amber-500/40 rounded-full px-5 py-1.5 text-amber-200 text-sm md:text-base backdrop-blur">
          {hint}
        </span>
      </div>

      <div className="grid grid-cols-5 sm:grid-cols-7 gap-x-3 gap-y-4 w-full max-w-2xl mx-auto">
        {allCases.map((idx) => {
          const wasOpened = openedMap.has(idx)
          const revealed = wasOpened || (revealAll && game.all_cases[idx] !== undefined)
          const value = wasOpened ? openedMap.get(idx) : revealAll ? game.all_cases[idx] : null
          const isPlayerCase = idx === game.player_case
          const isOpening = idx === openingCase
          // 终局揭晓时，命运之箱金光高亮
          const isFinalStar = isFinished && isPlayerCase

          let disabled
          if (loading || isOpening) disabled = true
          else if (isChoosing) disabled = false
          else disabled = revealed || isPlayerCase || isFinished || isOffering

          return (
            <button
              key={idx}
              onClick={() => !disabled && onOpen(idx)}
              disabled={disabled}
              className={`
                aspect-[5/4] font-bold flex flex-col items-center justify-center
                ${revealed && !isFinalStar ? 'briefcase-opened' : 'briefcase'}
                ${!revealed && isPlayerCase && !isChoosing ? 'briefcase-mine' : ''}
                ${isFinalStar ? 'briefcase-mine final-star' : ''}
                ${revealAll && !wasOpened ? 'flip-in' : ''}
                ${isOpening ? 'opening' : ''}
                ${isChoosing && !loading ? 'choosing-pulse' : ''}
              `}
              style={revealAll && !wasOpened ? { animationDelay: `${idx * 50}ms` } : undefined}
            >
              {!revealed && <span className="bc-clasp bc-clasp-l" />}
              {!revealed && <span className="bc-clasp bc-clasp-r" />}
              <span className={`bc-plate ${revealed && !isFinalStar ? 'opacity-50' : ''}`}>#{idx + 1}</span>
              {revealed && (
                <span className={`text-[10px] md:text-xs mt-0.5 font-mono ${isFinalStar ? 'text-amber-900 font-black' : value >= 100000 ? 'text-red-400' : value >= 10000 ? 'text-amber-300' : 'text-green-400'}`}>
                  {formatMoney(value)}
                </span>
              )}
              {!revealed && isPlayerCase && !isChoosing && (
                <span className="text-[10px] md:text-xs mt-0.5 text-amber-900">你的箱子</span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default CaseGrid
