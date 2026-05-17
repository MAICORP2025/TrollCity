const STAFF_ROLES = new Set([
  'admin',
  'superadmin',
  'owner',
  'ceo',
  'staff',
  'lead_troll_officer',
  'troll_officer',
  'secretary',
  'prosecutor',
  'attorney',
  'hr_admin',
  'marketing_readonly',
  'empire_partner',
]);

export function isStaffProfile(profile: any): boolean {
  if (!profile) return false;

  const role = String(profile.role || '').toLowerCase();
  const trollRole = String(profile.troll_role || '').toLowerCase();

  return Boolean(
    profile.is_staff ||
      profile.is_admin ||
      // null-safe even if callers pass unexpected partial profiles
      (profile as any)?.is_superadmin === true ||
      profile.is_troll_officer ||
      profile.is_lead_officer ||
      profile.is_secretary ||
      profile.is_prosecutor ||
      profile.is_attorney ||
      STAFF_ROLES.has(role) ||
      STAFF_ROLES.has(trollRole)
  );
}
