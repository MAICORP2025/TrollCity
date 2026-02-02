import { supabase, isAdminEmail } from './supabase'

export const getUserRoles = async (): Promise<string[]> => {
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    console.warn('Unable to read signed-in user roles:', userError?.message)
    return []
  }

  // 1. Check user_roles table
  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
  
  const roles = (roleData || []).map((row) => row.role)

  // 2. Check user_profiles table for role and is_admin
  const { data: profileData } = await supabase
    .from('user_profiles')
    .select('role, is_admin, email')
    .eq('id', user.id)
    .single()

  if (profileData) {
    if (profileData.role === 'admin') roles.push('admin')
    if (profileData.is_admin) roles.push('admin')
    
    // 3. Check email
    if (isAdminEmail(profileData.email || user.email)) {
      roles.push('admin')
    }
  }

  return [...new Set(roles)]
}

export const isAdmin = async (): Promise<boolean> => {
  const roles = await getUserRoles()
  return roles.includes('admin')
}
