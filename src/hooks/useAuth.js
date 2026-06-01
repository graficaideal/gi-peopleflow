import { useAuth as useAuthCtx } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'

export function useAuth() {
  const { session, loading, signOut, authorized, accessDenied } = useAuthCtx()
  const user = session?.user ?? null

  const signIn = (email, password) =>
    supabase.auth.signInWithPassword({ email, password })

  const updateDisplayName = async (name) => {
    const { data, error } = await supabase.auth.updateUser({ data: { full_name: name } })
    if (error) throw error
    return data
  }

  return { user, loading, signIn, signOut, updateDisplayName, authorized, accessDenied }
}
