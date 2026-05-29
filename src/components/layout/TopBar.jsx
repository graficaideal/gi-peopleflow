import { useLocation } from 'react-router-dom'

const ROUTE_NAMES = {
  '/': 'Dashboard',
  '/employees': 'Colaboradores',
  '/evaluations': 'Avaliações',
  '/cycles': 'Ciclos',
  '/departments': 'Departamentos',
  '/settings': 'Definições',
}

export default function TopBar() {
  const { pathname } = useLocation()
  const segments = pathname.split('/').filter(Boolean)
  const sectionName = ROUTE_NAMES[`/${segments[0]}`] ?? null
  const currentName = ROUTE_NAMES[pathname] ?? sectionName ?? 'PeopleFlow'

  return (
    <header className="topbar">
      <span className="topbar-brand">PeopleFlow</span>
      <nav className="topbar-breadcrumb" aria-label="breadcrumb">
        <span>Início</span>
        {currentName !== 'Dashboard' && (
          <>
            <span className="breadcrumb-sep">/</span>
            <span className="breadcrumb-current">{currentName}</span>
          </>
        )}
      </nav>
    </header>
  )
}
