import { Pencil, Trash2, Play, Lock, Calendar, Eye, EyeOff } from 'lucide-react'
import CycleStatusBadge from './CycleStatusBadge'
import CycleTypeBadge from './CycleTypeBadge'
import { formatDate } from '../../utils/formatters'

export default function CycleCard({ cycle, onEdit, onDelete, onActivate, onCloseCycle }) {
  const isActive = cycle.status === 'active'
  const isDraft  = cycle.status === 'draft'

  return (
    <div className={`cy-card${isActive ? ' cy-card-active' : ''}`}>
      <div className="cy-card-main">
        <div className="cy-card-left">
          <div className="cy-card-name">{cycle.name}</div>
          <div className="cy-card-meta">
            <CycleTypeBadge type={cycle.type} />
            <span className="cy-meta-sep">·</span>
            <span className="cy-card-dates">
              <Calendar size={11} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />
              {cycle.start_date || cycle.end_date
                ? `${formatDate(cycle.start_date)} – ${formatDate(cycle.end_date)}`
                : 'Sem datas definidas'}
            </span>
            <span className="cy-meta-sep">·</span>
            <span className="cy-card-anon">
              {cycle.anonymous
                ? <><EyeOff size={11} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />Anónimo</>
                : <><Eye size={11} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />Identificado</>}
            </span>
          </div>
        </div>

        <div className="cy-card-right">
          <CycleStatusBadge status={cycle.status} />
          <div className="cy-card-actions">
            {isDraft && (
              <button className="cy-action-btn cy-action-activate" onClick={() => onActivate(cycle)} title="Ativar ciclo">
                <Play size={13} />
              </button>
            )}
            {isActive && (
              <button className="cy-action-btn cy-action-close" onClick={() => onCloseCycle(cycle)} title="Fechar ciclo">
                <Lock size={13} />
              </button>
            )}
            <button className="cy-action-btn" onClick={() => onEdit(cycle)} title="Editar">
              <Pencil size={13} />
            </button>
            <button className="cy-action-btn cy-action-danger" onClick={() => onDelete(cycle)} title="Apagar">
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
