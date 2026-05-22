export const DEFAULT_USERNAME = 'Troll Citizen';

export function resolveUsername(
  username: string | null | undefined,
  fallback: string = DEFAULT_USERNAME
): string {
  if (!username || username === 'Unknown') {
    return fallback;
  }
  return username;
}

export function buildUserProfile(source: any) {
  const getValidUsername = (...sources: (string | null | undefined)[]): string => {
    for (const src of sources) {
      if (src && src !== 'Unknown') {
        return src;
      }
    }
    return DEFAULT_USERNAME;
  };

  return {
    username: getValidUsername(
      source?.sender_name,
      source?.user_name,
      source?.username,
      source?.user_profiles?.username,
      source?.display_name,
      source?.user_profiles?.display_name,
      source?.email?.split('@')?.[0],
      source?.user_profiles?.email?.split('@')?.[0]
    ),
    avatar_url: source?.user_avatar || source?.avatar_url || source?.user_profiles?.avatar_url || '',
    role: source?.user_role || source?.role || source?.user_profiles?.role,
    troll_role: source?.user_troll_role || source?.troll_role || source?.user_profiles?.troll_role,
    created_at: source?.user_created_at || source?.created_at || source?.user_profiles?.created_at,
    rgb_username_expires_at: source?.user_rgb_expires_at || source?.rgb_username_expires_at || source?.user_profiles?.rgb_username_expires_at,
    glowing_username_color: source?.user_glowing_username_color || source?.glowing_username_color || source?.user_profiles?.glowing_username_color,
  };
}