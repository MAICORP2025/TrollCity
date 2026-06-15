import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface NewUser {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  created_at: string
  bio: string | null
}

export function useNewUsers(limit = 12) {
  const [users, setUsers] = useState<NewUser[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    async function fetch() {
      try {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('id, username, display_name, avatar_url, created_at, bio')
          .order('created_at', { ascending: false })
          .limit(limit)
        if (!mounted) return
        if (error) throw error
        setUsers(data || [])
      } catch {
        // Silently fail - section will just be empty
      } finally {
        if (mounted) setLoading(false)
      }
    }
    fetch()
    return () => { mounted = false }
  }, [limit])

  return { users, loading }
}
