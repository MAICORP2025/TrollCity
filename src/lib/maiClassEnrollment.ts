import { supabase } from '@/lib/supabase'

/**
 * Get available slots for an organization in a mai class
 */
export async function getAvailableSlotsForOrg(
  classId: string,
  organizationId: string
): Promise<number> {
  try {
    const { data, error } = await supabase.rpc(
      'get_available_mai_class_slots',
      {
        p_class_id: classId,
        p_org_id: organizationId,
      }
    )
    
    if (error) {
      console.error('Error getting available slots:', error)
      return 0
    }
    
    return data || 0
  } catch (error) {
    console.error('Exception getting available slots:', error)
    return 0
  }
}

/**
 * Enroll a student in a mai class
 */
export async function enrollStudentInClass(
  classId: string,
  studentId: string,
  organizationId: string
): Promise<{ success: boolean; error?: string; enrollmentId?: string }> {
  try {
    // Check available slots first
    const availableSlots = await getAvailableSlotsForOrg(classId, organizationId)
    
    if (availableSlots <= 0) {
      return {
        success: false,
        error: `Organization has reached the 20-student limit for this class`,
      }
    }
    
    // Attempt enrollment
    const { data, error } = await supabase
      .from('mai_class_enrollments')
      .insert({
        class_id: classId,
        student_id: studentId,
        organization_id: organizationId,
        status: 'enrolled',
      })
      .select()
      .single()
    
    if (error) {
      console.error('Enrollment error:', error)
      return {
        success: false,
        error: error.message || 'Failed to enroll student',
      }
    }
    
    return {
      success: true,
      enrollmentId: data?.id,
    }
  } catch (error: any) {
    console.error('Exception during enrollment:', error)
    return {
      success: false,
      error: error?.message || 'An error occurred during enrollment',
    }
  }
}

/**
 * Get enrollment count for organization in a class
 */
export async function getEnrollmentCountForOrg(
  classId: string,
  organizationId: string
): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('mai_class_enrollments')
      .select('*', { count: 'exact', head: true })
      .eq('class_id', classId)
      .eq('organization_id', organizationId)
      .eq('status', 'enrolled')
    
    if (error) {
      console.error('Error getting enrollment count:', error)
      return 0
    }
    
    return count || 0
  } catch (error) {
    console.error('Exception getting enrollment count:', error)
    return 0
  }
}

/**
 * Withdraw a student from a class
 */
export async function withdrawStudentFromClass(
  enrollmentId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('mai_class_enrollments')
      .update({
        status: 'withdrawn',
        withdrawn_date: new Date().toISOString(),
      })
      .eq('id', enrollmentId)
    
    if (error) {
      console.error('Withdrawal error:', error)
      return {
        success: false,
        error: error.message || 'Failed to withdraw student',
      }
    }
    
    return { success: true }
  } catch (error: any) {
    console.error('Exception during withdrawal:', error)
    return {
      success: false,
      error: error?.message || 'An error occurred during withdrawal',
    }
  }
}

/**
 * Get students enrolled in a class for a specific organization
 */
export async function getClassStudentsForOrg(
  classId: string,
  organizationId: string
): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('mai_class_enrollments')
      .select(
        `
        id,
        student_id,
        status,
        enrollment_date,
        user_profiles!student_id (
          id,
          username,
          avatar_url,
          troll_coins,
          trollmonds
        )
      `
      )
      .eq('class_id', classId)
      .eq('organization_id', organizationId)
      .eq('status', 'enrolled')
      .order('enrollment_date', { ascending: true })
    
    if (error) {
      console.error('Error getting class students:', error)
      return []
    }
    
    return data || []
  } catch (error) {
    console.error('Exception getting class students:', error)
    return []
  }
}

/**
 * Check if student is enrolled in a class
 */
export async function isStudentEnrolledInClass(
  classId: string,
  studentId: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('mai_class_enrollments')
      .select('id')
      .eq('class_id', classId)
      .eq('student_id', studentId)
      .eq('status', 'enrolled')
      .maybeSingle()
    
    if (error) {
      console.error('Error checking enrollment:', error)
      return false
    }
    
    return !!data
  } catch (error) {
    console.error('Exception checking enrollment:', error)
    return false
  }
}
