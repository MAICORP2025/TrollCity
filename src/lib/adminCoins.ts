/**
 * Admin Role and Level Management System
 * Admin verification and level management functions
 */

import { supabase } from './supabase'
import { isAdminEmail } from './supabase'

/**
 * Checks if a user is an admin
 */
export function isAdmin(user: { email?: string; role?: string } | null, profile: { role?: string; is_admin?: boolean } | null): boolean {
  if (!user && !profile) return false
  
  const email = user?.email
  const role = profile?.role || user?.role
  const isAdminFlag = profile?.is_admin

  return (
    role === 'admin' ||
    isAdminFlag === true ||
    (email && isAdminEmail(email))
  )
}

/**
 * Grants levels to a user (admin action)
 */
export async function grantAdminLevels(
  targetUserId: string,
  levelAmount: number,
  _reason?: string
): Promise<{ success: boolean; error?: string; newLevel?: number }> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: adminProfile } = await supabase
      .from('user_profiles')
      .select('role, is_admin, email')
      .eq('id', user?.id || '')
      .single()

    if (!isAdmin(user, adminProfile)) {
      return { success: false, error: 'Only admins can grant levels' }
    }

    const { data: targetProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('id, level')
      .eq('id', targetUserId)
      .single()

    if (profileError || !targetProfile) {
      return { success: false, error: 'User not found' }
    }

    const currentLevel = targetProfile.level || 1
    const newLevel = Math.max(1, currentLevel + levelAmount)

    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({
        level: newLevel,
        updated_at: new Date().toISOString()
      })
      .eq('id', targetUserId)

    if (updateError) {
      return { success: false, error: 'Failed to update level' }
    }

    return { success: true, newLevel }
  } catch (error: any) {
    console.error('Error granting admin levels:', error)
    return { success: false, error: error.message || 'Unknown error' }
  }
}

/**
 * Deducts levels from a user (admin action)
 */
export async function deductAdminLevels(
  targetUserId: string,
  levelAmount: number,
  _reason?: string
): Promise<{ success: boolean; error?: string; newLevel?: number }> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: adminProfile } = await supabase
      .from('user_profiles')
      .select('role, is_admin, email')
      .eq('id', user?.id || '')
      .single()

    if (!isAdmin(user, adminProfile)) {
      return { success: false, error: 'Only admins can deduct levels' }
    }

    const { data: targetProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('id, level')
      .eq('id', targetUserId)
      .single()

    if (profileError || !targetProfile) {
      return { success: false, error: 'User not found' }
    }

    const currentLevel = targetProfile.level || 1
    const newLevel = Math.max(1, currentLevel - levelAmount)

    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({
        level: newLevel,
        updated_at: new Date().toISOString()
      })
      .eq('id', targetUserId)

    if (updateError) {
      return { success: false, error: 'Failed to update level' }
    }

    return { success: true, newLevel }
  } catch (error: any) {
    console.error('Error deducting admin levels:', error)
    return { success: false, error: error.message || 'Unknown error' }
  }
}
