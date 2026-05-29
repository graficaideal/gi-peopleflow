import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Users, ClipboardList, RefreshCcw,
  Building2, Settings, Sun, Moon, LogOut
} from 'lucide-react'
import { useTheme } from '../../context/ThemeContext'
import { useAuth } from '../../hooks/useAuth'

const NAV_ITEMS = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/employees', icon: Users, label: 'Colaboradores' },
  { to: '/evaluations', icon: ClipboardList, label: 'Avaliações' },
  { to: '/cycles', icon: RefreshCcw, label: 'Ciclos' },
  { to: '/departments', icon: Building2, label: 'Departamentos' },
  { to: '/settings', icon: Settings, label: 'Definições' },
]

export default function Sidebar() {
  const { theme, toggleTheme } = useTheme()
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const initials = user?.email
    ? user.email.slice(0, 2).toUpperCase()
    : 'GI'

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">GI</div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => `sidebar-item${isActive ? ' active' : ''}`}
            title={label}
          >
            <Icon size={20} strokeWidth={1.75} />
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <button
          className="sidebar-item"
          onClick={toggleTheme}
          title={theme === 'light' ? 'Modo escuro' : 'Modo claro'}
        >
          {theme === 'light'
            ? <Moon size={18} strokeWidth={1.75} />
            : <Sun size={18} strokeWidth={1.75} />}
        </button>
        <button
          className="sidebar-item"
          onClick={handleSignOut}
          title="Sair"
        >
          <LogOut size={18} strokeWidth={1.75} />
        </button>
        <div className="sidebar-avatar" title={user?.email ?? ''}>
          {initials}
        </div>
      </div>
    </aside>
  )
}
