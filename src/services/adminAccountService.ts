// ============================================================
// ADMIN ACCOUNT CREATION SERVICE
// Creates teacher and admissions director accounts
// Uses Supabase Admin API via edge function
// ============================================================

import { supabase } from '@/lib/supabase';

export interface CreateTeacherParams {
  email: string;
  username: string;
  password: string;
  fullName: string;
  bio?: string;
  specialties?: string[];
}

export interface CreateAdmissionsDirectorParams {
  email: string;
  username: string;
  password: string;
  fullName: string;
}

/**
 * Create a new teacher account
 * 1. Creates auth user
 * 2. Creates user_profiles row with academy_teacher role
 * 3. Creates academy_teachers record
 */
export const createTeacherAccount = async (params: CreateTeacherParams): Promise<{ success: boolean; error?: string; userId?: string }> => {
  try {
    // Call the admin edge function to create the account
    const { data, error } = await supabase.functions.invoke('admin-create-account', {
      body: {
        type: 'teacher',
        email: params.email,
        username: params.username,
        password: params.password,
        fullName: params.fullName,
        bio: params.bio || '',
        specialties: params.specialties || [],
      },
    });

    if (error) {
      console.error('Error creating teacher account:', error);
      return { success: false, error: error.message || 'Failed to create teacher account' };
    }

    return { success: true, userId: data?.userId };
  } catch (err: any) {
    console.error('Error creating teacher account:', err);
    return { success: false, error: err.message || 'Failed to create teacher account' };
  }
};

/**
 * Create a new admissions director account
 * 1. Creates auth user
 * 2. Creates user_profiles row with admissions_officer role
 */
export const createAdmissionsDirectorAccount = async (params: CreateAdmissionsDirectorParams): Promise<{ success: boolean; error?: string; userId?: string }> => {
  try {
    const { data, error } = await supabase.functions.invoke('admin-create-account', {
      body: {
        type: 'admissions_director',
        email: params.email,
        username: params.username,
        password: params.password,
        fullName: params.fullName,
      },
    });

    if (error) {
      console.error('Error creating admissions director account:', error);
      return { success: false, error: error.message || 'Failed to create admissions director account' };
    }

    return { success: true, userId: data?.userId };
  } catch (err: any) {
    console.error('Error creating admissions director account:', err);
    return { success: false, error: err.message || 'Failed to create admissions director account' };
  }
};

/**
 * Direct client-side account creation (fallback if edge function not available)
 * This creates the profile and role records after the auth user exists
 */
export const createTeacherProfile = async (userId: string, params: CreateTeacherParams): Promise<{ success: boolean; error?: string }> => {
  try {
    // Create user profile
    const { error: profileError } = await supabase.from('user_profiles').upsert({
      id: userId,
      username: params.username,
      email: params.email,
      display_name: params.fullName,
      role: 'academy_teacher',
      bio: params.bio || '',
      troll_coins: 0,
      total_earned_coins: 0,
      total_spent_coins: 0,
      tier: 'Bronze',
    });

    if (profileError) {
      console.error('Error creating teacher profile:', profileError);
      return { success: false, error: profileError.message };
    }

    // Create academy_teachers record
    const teacherId = `TCH-${new Date().getFullYear()}-${Date.now()}`;
    const { error: teacherError } = await supabase.from('academy_teachers').insert({
      user_id: userId,
      teacher_id: teacherId,
      bio: params.bio || '',
      specialties: params.specialties || [],
      is_active: true,
      is_approved: true,
      total_students: 0,
      total_graduates: 0,
      total_certificates_issued: 0,
      average_rating: 0,
      total_ratings: 0,
    });

    if (teacherError) {
      console.error('Error creating academy_teachers record:', teacherError);
      return { success: false, error: teacherError.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error('Error creating teacher profile:', err);
    return { success: false, error: err.message };
  }
};

export const createAdmissionsDirectorProfile = async (userId: string, params: CreateAdmissionsDirectorParams): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error: profileError } = await supabase.from('user_profiles').upsert({
      id: userId,
      username: params.username,
      email: params.email,
      display_name: params.fullName,
      role: 'admissions_officer',
      troll_coins: 0,
      total_earned_coins: 0,
      total_spent_coins: 0,
      tier: 'Bronze',
    });

    if (profileError) {
      console.error('Error creating admissions director profile:', profileError);
      return { success: false, error: profileError.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error('Error creating admissions director profile:', err);
    return { success: false, error: err.message };
  }
};
