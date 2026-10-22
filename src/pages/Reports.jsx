import { Link } from 'react-router-dom'
import { Table2, MessageSquareText } from 'lucide-react'

const REPORTS = [
  {
    to: '/reports/evaluations',
    icon: Table2,
    title: 'Avaliações por Ciclo',
    description: 'Médias globais e por tipo de avaliação de cada colaborador ativo.',
  },
  {
    to: '/reports/observations',
    icon: MessageSquareText,
    title: 'Observações por Ciclo',
    description: 'Observações gerais e por critério, agrupadas por colaborador avaliado.',
  },
]

export default function Reports() {
  return (
    <div>
      <div className="rp-header">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="page-subtitle">{REPORTS.length} reports disponíveis</p>
        </div>
      </div>

      <div className="rp-cards">
        {REPORTS.map(({ to, icon: Icon, title, description }) => (
          <Link key={to} to={to} className="rp-card">
            <div className="rp-card-icon"><Icon size={20} strokeWidth={1.75} /></div>
            <div>
              <div className="rp-card-title">{title}</div>
              <div className="rp-card-desc">{description}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
