import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 16 }}>
      <h1 style={{ fontSize: 48, fontWeight: 700, color: 'var(--color-accent)' }}>404</h1>
      <p style={{ color: 'var(--color-text-muted)' }}>Página não encontrada</p>
      <Link to="/" style={{ color: 'var(--color-accent)', fontWeight: 500 }}>Voltar ao início</Link>
    </div>
  )
}
