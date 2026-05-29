import { SCORE_LABELS, CYCLE_TYPE_LABELS, CYCLE_STATUS_LABELS, EVALUATION_TYPE_LABELS } from '../lib/constants'

export const formatScore = (score) => SCORE_LABELS[score] ?? '-'
export const formatCycleType = (type) => CYCLE_TYPE_LABELS[type] ?? type
export const formatCycleStatus = (status) => CYCLE_STATUS_LABELS[status] ?? status
export const formatEvaluationType = (type) => EVALUATION_TYPE_LABELS[type] ?? type

export const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export const calcAverage = (scores) => {
  const valid = Object.values(scores).filter(v => typeof v === 'number' && v > 0)
  if (!valid.length) return null
  return (valid.reduce((a, b) => a + b, 0) / valid.length).toFixed(1)
}

export const scoreToLabel = (avg) => {
  if (!avg) return '-'
  const rounded = Math.round(avg)
  return SCORE_LABELS[rounded] ?? '-'
}
