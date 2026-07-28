export const CASE_VALUES = [
  0.01, 1, 5, 10, 25, 50, 75, 100,
  200, 300, 400, 500, 750, 1000, 5000, 10000,
  25000, 50000, 75000, 100000, 200000, 300000, 400000, 500000, 750000, 1000000
]

export const ENTRY_FEE = 80000
export const SUPER_ENTRY_FEE = 200000

// 奖金榜按模式取：福利模式所有 ≥10 万的全是 100 万（19 小 + 7 个百万箱）
export function boardValues(mode) {
  return mode === 'super' ? CASE_VALUES.map((v) => (v >= 100000 ? 1000000 : v)) : CASE_VALUES
}

export function modeEntryFee(mode) {
  return mode === 'super' ? SUPER_ENTRY_FEE : ENTRY_FEE
}

export function formatMoney(value) {
  if (value == null) return '-'
  const sign = value < 0 ? '-' : ''
  const v = Math.abs(value)
  if (v >= 1000000) return `${sign}$${(v / 1000000).toFixed(2)}M`
  if (v >= 1000) return `${sign}$${(v / 1000).toFixed(0)}K`
  return `${sign}$${v}`
}
