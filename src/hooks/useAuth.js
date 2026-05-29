import { useAuthContext } from '../context/AuthContext'

export function useAuth() {
  const { user, loading, signIn, signOut, updateDisplayName } = useAuthContext()
  return { user, loading, signIn, signOut, updateDisplayName }
}
