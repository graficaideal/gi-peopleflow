import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Users, ClipboardList, RefreshCcw,
  Building2, Settings
} from 'lucide-react'

const NAV_ITEMS = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/employees', icon: Users, label: 'Colaboradores' },
  { to: '/evaluations', icon: ClipboardList, label: 'Avaliações' },
  { to: '/cycles', icon: RefreshCcw, label: 'Ciclos' },
  { to: '/departments', icon: Building2, label: 'Departamentos' },
  { to: '/settings', icon: Settings, label: 'Definições' },
]

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <img
        src="/logo.svg"
        alt="GI"
        style={{ width: 32, height: 'auto', marginBottom: 20, flexShrink: 0 }}
      />

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
    </aside>
  )
}
