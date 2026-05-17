import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'
import { toast } from 'sonner'

export interface OrganizationMessage {
  id: string
  org_id: string
  sender_id: string | null
  content: string | null
  message_type: 'text' | 'announcement' | 'file' | 'system'
  is_urgent: boolean
  pinned: boolean
  created_at: string
}

export function useOrganizationMessages(orgId?: string | null) {
  const { profile } = useAuthStore() as any
  const [messages, setMessages] = useState<OrganizationMessage[]>([])
  const [loading, setLoading] = useState(false)

  const loadMessages = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('organization_messages')
        .select('*')
        .eq('org_id', orgId)
        .order('created_at', { ascending: true })
        .limit(200)
      if (error) throw error
      setMessages((data || []) as OrganizationMessage[])
    } catch (err: any) {
      console.error('[useOrganizationMessages]', err)
      toast.error(err?.message || 'Failed to load organization messages')
    } finally {
      setLoading(false)
    }
  }, [orgId])

  useEffect(() => {
    void loadMessages()
  }, [loadMessages])

  useEffect(() => {
    if (!orgId) return
    const channel = supabase
      .channel(`organization_messages:${orgId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'organization_messages', filter: `org_id=eq.${orgId}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as OrganizationMessage])
        }
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [orgId])

  const sendMessage = async (content: string, urgent = false, pinned = false) => {
    if (!orgId || !profile?.id || !content.trim()) return false
    const { data, error } = await supabase
      .from('organization_messages')
      .insert({
        org_id: orgId,
        sender_id: profile.id,
        content: content.trim(),
        message_type: urgent ? 'announcement' : 'text',
        is_urgent: urgent,
        pinned,
      })
      .select('id')
      .single()
    if (error) {
      toast.error(error.message)
      return false
    }
    await supabase.rpc('record_organization_audit', {
      p_org_id: orgId,
      p_action: 'message_sent',
      p_target_type: 'organization_message',
      p_target_id: data.id,
      p_metadata: { urgent, pinned },
    })
    return true
  }

  return { messages, loading, sendMessage, reload: loadMessages }
}
