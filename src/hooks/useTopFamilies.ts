import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface TopFamily {
  id: string
  name: string
  logo_url: string | null
  member_count: number
  rank: number
  achievement: string | null
}

export function useTopFamilies(limit = 10) {
  const [families, setFamilies] = useState<TopFamily[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    async function fetch() {
      try {
        const { data, error } = await supabase
          .from('troll_families')
          .select('id, name, logo_url, member_count, rank, achievement')
          .order('rank', { ascending: true })
          .limit(limit)
        if (!mounted) return
        if (error) throw error
        setFamilies(data || [])
      } catch {
        // Silently fail
      } finally {
        if (mounted) setLoading(false)
      }
    }
    fetch()
    return () => { mounted = false }
  }, [limit])

  return { families, loading }
}
