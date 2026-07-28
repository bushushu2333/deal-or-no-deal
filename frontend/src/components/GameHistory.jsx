import { useEffect, useState } from 'react'
import { formatMoney } from '../constants'

const API_BASE = 'http://localhost:8000/api'

function GameHistory({ open, onClose }) {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!open) return
    const fetchHistory = async () => {
      try {
        const res = await fetch(`${API_BASE}/history`)
        const data = await res.json()
        setHistory(data.filter((g) => g.final_result && g.final_result !== 'ongoing'))
      } catch (err) {
        console.error('Failed to fetch history', err)
      }
      setLoading(false)
    }
    fetchHistory()
  }, [open])

  if (!open) return null

  // 赌王 = 单局盈亏最高纪录
  const bestProfit = history.reduce((m, g) => Math.max(m, g.profit ?? -Infinity), -Infinity)

  return (
    <div className="fixed inset-0 z-40 fade-in" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="absolute top-0 right-0 h-full w-full max-w-lg bg-[#150a10] border-l border-amber-500/30 shadow-2xl p-6 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-xl font-bold text-amber-300">历史战绩</h2>
          <button onClick={onClose} className="text-amber-200/60 hover:text-amber-200 text-2xl leading-none">×</button>
        </div>
        {loading ? (
          <div className="text-amber-200/50">加载中...</div>
        ) : history.length === 0 ? (
          <div className="text-amber-200/50">暂无记录</div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-amber-200/50 border-b border-amber-500/20">
                <th className="py-2">时间</th>
                <th className="py-2">玩家</th>
                <th className="py-2">结果</th>
                <th className="py-2">带走</th>
                <th className="py-2">箱中</th>
                <th className="py-2">盈亏</th>
              </tr>
            </thead>
            <tbody>
              {history.map((g) => (
                <tr key={g.id} className="border-b border-amber-500/10">
                  <td className="py-2 text-amber-100/70">
                    {new Date(g.created_at).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="py-2 text-amber-200 font-bold">
                    {g.profit === bestProfit && bestProfit > -Infinity && '👑 '}{g.player_name || '神秘赌客'}
                    {g.mode === 'super' && <span className="ml-1 text-red-400" title="超级福利模式">🎁</span>}
                  </td>
                  <td className="py-2 text-amber-100/70">{g.final_result === 'deal' ? '成交' : '坚持到底'}</td>
                  <td className="py-2 text-amber-100/70">{g.final_winnings !== null ? formatMoney(g.final_winnings) : '-'}</td>
                  <td className="py-2 text-amber-100/70">{g.player_case_value !== null && g.player_case_value !== undefined ? formatMoney(g.player_case_value) : '-'}</td>
                  <td className={`py-2 font-bold ${(g.profit || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {g.profit !== null ? formatMoney(g.profit) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

export default GameHistory
