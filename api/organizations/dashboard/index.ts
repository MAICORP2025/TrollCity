import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseAdmin } from '../../_shared/auth'

export const runtime = 'edge'

export async function GET(request: Request, { params }: { params: { orgId?: string } }) {
  try {
    // Get auth token from header
    const token = getAuthToken(request)
    const { data: userData, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const userId = userData.user.id

    // Get user profile
    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('id, username, organization_id, is_admin, role')
      .eq('id', userId)
      .single()

    if (!profile) {
      return new Response(JSON.stringify({ error: 'Profile not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Check if requesting all organizations (CEO/Admin only)
    const url = new URL(request.url)
    const getAll = url.searchParams.get('all') === 'true'

    if (getAll) {
      // Only admins and CEOs can fetch all orgs
      const isAdmin = profile.is_admin || profile.role === 'admin' || profile.role === 'ceo' || profile.role === 'owner'
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: 'Access denied' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      // Fetch all organizations with their admin counts
      const { data: orgs, error: orgsError } = await supabaseAdmin
        .from('organizations')
        .select('*')
        .order('created_at', { ascending: false })

      if (orgsError) {
        throw orgsError
      }

      // For each org, get student count and admin count
      const orgsWithStats = await Promise.all(
        (orgs || []).map(async (org: any) => {
          const [{ count: studentCount }, { count: adminCount }] = await Promise.all([
            supabaseAdmin
              .from('organization_students')
              .select('*', { count: 'exact', head: true })
              .eq('organization_id', org.id)
              .eq('status', 'active'),
            supabaseAdmin
              .from('organization_admins')
              .select('*', { count: 'exact', head: true })
              .eq('organization_id', org.id)
          ])

          return {
            id: org.id,
            name: org.name,
            description: org.description,
            email: org.email,
            website: org.website,
            country: org.country,
            status: org.status,
            student_limit: org.student_limit,
            current_student_count: studentCount || 0,
            admin_count: adminCount || 0,
            mai_class_enrolled: 0, // Will be computed separately if needed
            created_at: org.created_at,
          }
        })
      )

      return new Response(JSON.stringify({ organizations: orgsWithStats }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Single org mode (existing logic)
    let orgId = params.orgId

    // If no orgId in params, use user's organization
    if (!orgId) {
      if (!profile.organization_id) {
        return new Response(JSON.stringify({ error: 'No organization found. Create one first.' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        })
      }
      orgId = profile.organization_id
    } else {
      // Verify user belongs to this org if not admin
      if (!profile.is_admin) {
        const { data: membership } = await supabaseAdmin
          .from('organization_admins')
          .select('id')
          .eq('organization_id', orgId)
          .eq('user_id', userId)
          .maybeSingle()

        if (!membership) {
          return new Response(JSON.stringify({ error: 'Access denied' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' }
          })
        }
      }
    }

    // Fetch organization details
    const { data: org, error: orgError } = await supabaseAdmin
      .from('organizations')
      .select('*')
      .eq('id', orgId)
      .single()

    if (orgError || !org) {
      return new Response(JSON.stringify({ error: 'Organization not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

     // Fetch org admins (raw)
     const { data: adminsRaw, error: adminsError } = await supabaseAdmin
       .from('organization_admins')
       .select('id, role, added_at, user_id')
       .eq('organization_id', orgId)
       .order('added_at', { ascending: true })

     if (adminsError) {
       console.error('[org dashboard] error fetching admins:', adminsError);
       // Return error response instead of crashing
       return new Response(JSON.stringify({ 
         error: 'Failed to fetch organization admins',
         details: adminsError.message 
       }), {
         status: 500,
         headers: { 'Content-Type': 'application/json' }
       });
     }

      // Fetch profiles for each admin user_id
      const adminUserIds = (adminsRaw || []).map((a: any) => a.user_id);
      let adminProfiles: any[] = [];
      
      if (adminUserIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabaseAdmin
          .from('user_profiles')
          .select('id, username, avatar_url')
          .in('id', adminUserIds);
        
        if (profilesError) {
          console.error('[org dashboard] error fetching admin profiles:', profilesError);
        } else {
          adminProfiles = profiles || [];
        }
      }

      // Combine admins with their profiles
      const admins = (adminsRaw || []).map((admin: any) => {
        const profile = adminProfiles.find((p: any) => p.id === admin.user_id);
        return {
          id: admin.id,
          role: admin.role,
          added_at: admin.added_at,
          user_id: admin.user_id,
          user: profile || { id: admin.user_id, username: 'Unknown', avatar_url: null }
        };
      });

    // Fetch org students/members
    const { data: students } = await supabaseAdmin
      .from('user_profiles')
      .select('id, username, avatar_url, organization_id, created_at')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: true })

    // Fetch Mai Class enrollment stats for this org
    const { count: enrolledCount } = await supabaseAdmin
      .from('mai_class_enrollments')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('status', 'enrolled')

     // Is current user an admin of this org?
     const isOrgAdmin = admins?.some((a: any) => a.user_id === userId) || profile.is_admin

     const dashboardData = {
       organization: {
         id: org.id,
         name: org.name,
         description: org.description,
         email: org.email,
         website: org.website,
         country: org.country,
         status: org.status,
         student_limit: org.student_limit,
         current_student_count: students?.length || 0,
         mai_class_enrolled: enrolledCount || 0,
         created_at: org.created_at,
       },
       admins: admins?.map((a: any) => ({
         id: a.id,
         role: a.role,
         added_at: a.added_at,
         user: a.user,
       })) || [],
       members: students?.map((s: any) => ({
         id: s.id,
         username: s.username,
         avatar_url: s.avatar_url,
       })) || [],
       userRole: isOrgAdmin ? 'admin' : 'member',
       canManage: isOrgAdmin,
     }

    return new Response(JSON.stringify(dashboardData), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (err: any) {
    console.error('[org dashboard error]', err)
    return new Response(JSON.stringify({ error: err?.message || 'Request failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

function getAuthToken(request: Request): string {
  const authHeader = request.headers.get('Authorization') || request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Missing auth token')
  }
  return authHeader.slice('Bearer '.length).trim()
}
