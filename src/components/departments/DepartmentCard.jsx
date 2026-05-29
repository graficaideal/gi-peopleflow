import { Building2, ChevronDown, ChevronUp, Pencil, Trash2, Plus, Users } from 'lucide-react'

export default function DepartmentCard({
  dept,
  index = 0,
  expanded,
  onToggle,
  onEditDept,
  onDeleteDept,
  onAddTeam,
  onEditTeam,
  onDeleteTeam,
}) {
  const teamCount = dept.teams?.length ?? 0

  return (
    <div
      className={`dept-card${expanded ? ' expanded' : ''}`}
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <div className="dept-header">
        <div className="dept-icon">
          <Building2 size={17} strokeWidth={1.75} />
        </div>
        <div className="dept-info">
          <div className="dept-name">{dept.name}</div>
        </div>
        <div className="dept-actions">
          <button
            className="dept-action-btn"
            onClick={() => onEditDept(dept)}
            title="Editar departamento"
          >
            <Pencil size={13} />
          </button>
          <button
            className="dept-action-btn danger"
            onClick={() => onDeleteDept(dept)}
            title="Apagar departamento"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      <div className="dept-footer">
        <span className="dept-team-count">
          <Users size={11} />
          {teamCount} equipa{teamCount !== 1 ? 's' : ''}
        </span>
        <button className="dept-expand-btn" onClick={onToggle}>
          {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          {expanded ? 'Fechar' : 'Equipas'}
        </button>
      </div>

      {expanded && (
        <div className="dept-teams">
          <div className="dept-teams-inner">
            {teamCount === 0 && (
              <p style={{ fontSize: 12, color: 'var(--color-text-muted)', padding: '2px 0 6px' }}>
                Sem equipas neste departamento.
              </p>
            )}
            {dept.teams.map(team => (
              <div key={team.id} className="team-row">
                <span className="team-dot" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="team-name">{team.name}</div>
                </div>
                <div className="team-actions">
                  <button
                    className="team-action-btn"
                    onClick={() => onEditTeam(team, dept.id)}
                    title="Editar equipa"
                  >
                    <Pencil size={11} />
                  </button>
                  <button
                    className="team-action-btn danger"
                    onClick={() => onDeleteTeam(team)}
                    title="Apagar equipa"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            ))}
            <button className="dept-add-team" onClick={() => onAddTeam(dept.id)}>
              <Plus size={12} />
              Nova equipa
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
