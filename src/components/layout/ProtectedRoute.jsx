import { useRef } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

export default function ProtectedRoute({ children }) {
  const { authorized, loading } = useAuth()
  const wasAuthorized = useRef(false)

  if (authorized === true) wasAuthorized.current = true

  // If a re-check is in progress but the user was already authorized,
  // keep children mounted — don't flash the spinner and lose page state.
  if (loading && wasAuthorized.current) return children

  // Initial auth check (first load, not yet known)
  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
      </div>
    )
  }

  if (!authorized) {
    return <Navigate to="/login" replace />
  }

  return children
}
