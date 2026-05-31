import { useState, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Sun, Moon, Settings, LogOut } from 'lucide-react'
import { useTheme } from '../../context/ThemeContext'
import { useAuth } from '../../hooks/useAuth'

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
  const navigate = useNavigate()
  const { theme, toggleTheme } = useTheme()
  const { user, signOut } = useAuth()

  const [open, setOpen] = useState(false)
  const dropdownRef = useRef(null)

  const segments = pathname.split('/').filter(Boolean)
  const sectionName = ROUTE_NAMES[`/${segments[0]}`] ?? null
  const currentName = ROUTE_NAMES[pathname] ?? sectionName ?? 'PeopleFlow'

  const fullName = user?.user_metadata?.full_name
  const displayName = fullName || user?.email || ''
  const initials = fullName
    ? fullName.split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : (user?.email?.slice(0, 2).toUpperCase() ?? 'GI')

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

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

      <div className="topbar-actions">
        <button
          className="topbar-icon-btn"
          onClick={toggleTheme}
          title={theme === 'light' ? 'Modo escuro' : 'Modo claro'}
        >
          {theme === 'light'
            ? <Moon size={17} strokeWidth={1.75} />
            : <Sun size={17} strokeWidth={1.75} />}
        </button>

        <div className="topbar-avatar-wrap" ref={dropdownRef}>
          <button
            className="topbar-avatar-btn"
            onClick={() => setOpen(v => !v)}
          >
            {initials}
          </button>

          {open && (
            <div className="topbar-dropdown">
              <div className="topbar-dropdown-header">
                <span className="topbar-dropdown-name">{displayName}</span>
                {fullName && (
                  <span className="topbar-dropdown-email">{user.email}</span>
                )}
              </div>
              <div className="topbar-dropdown-divider" />
              <button
                className="topbar-dropdown-item"
                onClick={() => { navigate('/settings'); setOpen(false) }}
              >
                <Settings size={14} />
                Definições
              </button>
              <button
                className="topbar-dropdown-item topbar-dropdown-item--danger"
                onClick={handleSignOut}
              >
                <LogOut size={14} />
                Sair
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
