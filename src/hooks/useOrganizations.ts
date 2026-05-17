import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'
import { toast } from 'sonner'

export type OrganizationStatus = 'onboarding' | 'active' | 'suspended' | 'dropped'

export interface OrganizationRecord {
  id: string
  name: string
  slug?: string | null
  status: OrganizationStatus
  org_type?: string | null
  description?: string | null
  email?: string | null
  phone?: string | null
  website?: string | null
  country?: string | null
  primary_contact_name?: string | null
  primary_contact_email?: string | null
  primary_contact_phone?: string | null
  logo_url?: string | null
  notes?: string | null
  assigned_admin_id?: string | null
  admin_user_id?: string | null
  created_by?: string | null
  created_at: string
  updated_at?: string | null
  dropped_at?: string | null
  suspended_at?: string | null
  is_public?: boolean | null
  current_student_count?: number | null
  student_limit?: number | null
}

const staffRoles = new Set([
  'admin',
  'superadmin',
  'ceo',
  'owner',
  'hr_admin',
  'staff',
  'secretary',
  'moderator',
  'troll_officer',
  'lead_troll_officer',
  'prosecutor',
  'attorney',
])

export function isOrgStaffProfile(profile: any) {
  const role = String(profile?.role || '').toLowerCase()
  const trollRole = String(profile?.troll_role || '').toLowerCase()
  return Boolean(
    profile?.is_admin ||
      profile?.is_superadmin ||
      profile?.is_troll_officer ||
      profile?.is_lead_officer ||
      staffRoles.has(role) ||
      staffRoles.has(trollRole)
  )
}

export function useOrganizations(selectedOrgId?: string | null) {
  const { profile } = useAuthStore() as any
  const [organizations, setOrganizations] = useState<OrganizationRecord[]>([])
  const [selectedOrg, setSelectedOrg] = useState<OrganizationRecord | null>(null)
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const isStaff = useMemo(() => isOrgStaffProfile(profile), [profile])
  const userOrgId = profile?.organization_id || null

  const loadOrganizations = useCallback(async () => {
    if (!profile?.id) return
    setLoading(true)
    try {
      let query = supabase
        .from('organizations')
        .select('*')
        .order('created_at', { ascending: false })

      if (!isStaff) {
        query = query.eq('id', userOrgId)
      }

      const { data, error } = await query
      if (error) throw error

      const rows = (data || []) as OrganizationRecord[]
      setOrganizations(rows)

      const nextSelected =
        rows.find((org) => org.id === selectedOrgId) ||
        rows.find((org) => org.id === userOrgId) ||
        rows[0] ||
        null
      setSelectedOrg(nextSelected)

      if (rows.length) {
        const ids = rows.map((org) => org.id)
        const { data: members } = await supabase
          .from('organization_members')
          .select('org_id, status')
          .in('org_id', ids)
          .eq('status', 'active')
        const counts = (members || []).reduce<Record<string, number>>((acc, row: any) => {
          acc[row.org_id] = (acc[row.org_id] || 0) + 1
          return acc
        }, {})
        setMemberCounts(counts)
      } else {
        setMemberCounts({})
      }
    } catch (err: any) {
      console.error('[useOrganizations]', err)
      toast.error(err?.message || 'Failed to load organizations')
    } finally {
      setLoading(false)
    }
  }, [isStaff, profile?.id, selectedOrgId, userOrgId])

  useEffect(() => {
    void loadOrganizations()
  }, [loadOrganizations])

  const createOrganization = async (values: Partial<OrganizationRecord>) => {
    if (!profile?.id) return null
    const name = values.name?.trim()
    const email = values.email?.trim() || values.primary_contact_email?.trim()
    if (!name || !email) {
      toast.error('Organization name and email are required')
      return null
    }

    const slug = (values.slug || name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')

    const payload = {
      name,
      slug,
      email,
      phone: values.phone || values.primary_contact_phone || null,
      website: values.website || null,
      country: values.country || null,
      description: values.description || null,
      org_type: values.org_type || 'program',
      primary_contact_name: values.primary_contact_name || null,
      primary_contact_email: values.primary_contact_email || email,
      primary_contact_phone: values.primary_contact_phone || values.phone || null,
      status: values.status || 'onboarding',
      is_public: values.is_public ?? false,
      student_limit: values.student_limit || 100,
      current_student_count: 0,
      admin_user_id: profile.id,
      created_by: profile.id,
      assigned_admin_id: profile.id,
      notes: values.notes || null,
    }

    const { data, error } = await supabase.from('organizations').insert(payload).select('*').single()
    if (error) {
      toast.error(error.message)
      return null
    }
    await supabase.rpc('record_organization_audit', {
      p_org_id: data.id,
      p_action: 'organization_created',
      p_target_type: 'organization',
      p_target_id: data.id,
      p_metadata: { name },
    })
    toast.success('Organization created')
    await loadOrganizations()
    return data as OrganizationRecord
  }

  const updateOrganization = async (orgId: string, patch: Partial<OrganizationRecord>) => {
    const { data, error } = await supabase
      .from('organizations')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', orgId)
      .select('*')
      .single()
    if (error) {
      toast.error(error.message)
      return null
    }
    await supabase.rpc('record_organization_audit', {
      p_org_id: orgId,
      p_action: 'organization_updated',
      p_target_type: 'organization',
      p_target_id: orgId,
      p_metadata: patch,
    })
    setOrganizations((prev) => prev.map((org) => (org.id === orgId ? (data as OrganizationRecord) : org)))
    setSelectedOrg((prev) => (prev?.id === orgId ? (data as OrganizationRecord) : prev))
    toast.success('Organization updated')
    return data as OrganizationRecord
  }

  const setOrganizationStatus = async (orgId: string, status: OrganizationStatus) => {
    const patch: Partial<OrganizationRecord> = { status }
    if (status === 'suspended') patch.suspended_at = new Date().toISOString()
    if (status === 'dropped') patch.dropped_at = new Date().toISOString()
    if (status === 'active') {
      patch.suspended_at = null
      patch.dropped_at = null
    }
    const data = await updateOrganization(orgId, patch)
    if (data) {
      await supabase.rpc('record_organization_audit', {
        p_org_id: orgId,
        p_action:
          status === 'suspended'
            ? 'organization_suspended'
            : status === 'dropped'
              ? 'organization_dropped'
              : 'organization_restored',
        p_target_type: 'organization',
        p_target_id: orgId,
        p_metadata: { status },
      })
    }
  }

  return {
    organizations,
    selectedOrg,
    setSelectedOrg,
    memberCounts,
    loading,
    isStaff,
    reload: loadOrganizations,
    createOrganization,
    updateOrganization,
    setOrganizationStatus,
  }
}
