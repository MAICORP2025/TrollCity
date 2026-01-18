import { supabase } from './supabase'

export const GLOWING_USERNAME_COLORS = [
  { name: 'Gold', value: '#FFD700', hex: 'FFD700' },
  { name: 'Cyan', value: '#00FFFF', hex: '00FFFF' },
  { name: 'Hot Pink', value: '#FF1493', hex: 'FF1493' },
  { name: 'Lime Green', value: '#00FF00', hex: '00FF00' },
  { name: 'Orange', value: '#FF8C00', hex: 'FF8C00' },
  { name: 'Purple', value: '#9D4EDD', hex: '9D4EDD' },
  { name: 'Red', value: '#FF0000', hex: 'FF0000' },
  { name: 'White', value: '#FFFFFF', hex: 'FFFFFF' },
  { name: 'Blue', value: '#0066FF', hex: '0066FF' },
  { name: 'Magenta', value: '#FF00FF', hex: 'FF00FF' },
]

export async function saveGlowingUsernameColor(
  userId: string,
  color: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('user_profiles')
      .update({
        glowing_username_color: color,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to save color' }
  }
}

export async function getGlowingUsernameColor(userId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('glowing_username_color')
      .eq('id', userId)
      .maybeSingle()

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching glow color:', error)
    }

    return data?.glowing_username_color || null
  } catch (err) {
    console.error('Exception in getGlowingUsernameColor:', err)
    return null
  }
}

export function getGlowingUsernameCSSStyle(color: string): string {
  return `
    color: ${color};
    text-shadow: 
      0 0 5px ${color}, 
      0 0 10px ${color}, 
      0 0 15px ${color}, 
      0 0 20px ${color};
    font-weight: bold;
    animation: glow-pulse 2s ease-in-out infinite;
  `
}
