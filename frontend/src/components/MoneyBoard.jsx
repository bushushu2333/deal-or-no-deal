import { boardValues, formatMoney } from '../constants'

function MoneyBoard({ game }) {
  const values = boardValues(game?.mode)
  const col1 = values.slice(0, 13)
  const col2 = values.slice(13)

  // 划掉要按"次数"算：福利模式有 7 个 $1.00M，开掉一个只划一格
  const openedCounts = {}
  ;(game?.opened_cases || []).forEach((o) => {
    openedCounts[o.value] = (openedCounts[o.value] || 0) + 1
  })

  const renderCol = (list) =>
    list.map((v, i) => {
      const out = (openedCounts[v] || 0) > 0
      if (out) openedCounts[v] -= 1
      return (
        <div
          key={i}
          className={`money-cell ${out ? 'money-cell-out' : ''} rounded px-2 py-1 text-center text-xs md:text-sm font-bold`}
        >
          {formatMoney(v)}
        </div>
      )
    })

  return (
    <div className="hidden lg:flex flex-col gap-1 w-32 xl:w-36 shrink-0 fade-in">
      <div className="text-center text-amber-300 text-sm font-bold mb-1 tracking-widest">
        奖金榜{game?.mode === 'super' && <span className="ml-1">🎁</span>}
      </div>
      <div className="grid grid-cols-2 gap-1">
        <div className="flex flex-col gap-1">{renderCol(col1)}</div>
        <div className="flex flex-col gap-1">{renderCol(col2)}</div>
      </div>
    </div>
  )
}

export default MoneyBoard
