import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  // session: undefined=loading | null=no session | object=session
  const [session, setSession] = useState(undefined)
  // authorized: undefined=checking | null=no session | true=has peopleflow access
  const [authorized, setAuthorized] = useState(undefined)
  const [accessDenied, setAccessDenied] = useState(false)

  // Effect 1: track raw auth state only
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session ?? null)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // TOKEN_REFRESHED only updates the access token — user and authorization
      // are unchanged. Updating session here would set authorized→undefined
      // (loading), causing ProtectedRoute to unmount and remount the entire
      // page tree every time the window regains focus.
      if (event === 'TOKEN_REFRESHED') return
      setSession(session ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Effect 2: verify peopleflow access whenever session changes
  useEffect(() => {
    if (session === undefined) return

    if (!session) {
      setAuthorized(null)
      return
    }

    setAuthorized(undefined) // checking…

    supabase
      .from('profiles')
      .select('apps')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => {
        const allowed = data?.apps?.includes('peopleflow') ?? false
        if (!allowed) {
          setAccessDenied(true)
          supabase.auth.signOut()
          return
        }
        setAccessDenied(false)
        setAuthorized(true)
      })
  }, [session])

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{
      session,
      authorized,
      loading: authorized === undefined,
      accessDenied,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
