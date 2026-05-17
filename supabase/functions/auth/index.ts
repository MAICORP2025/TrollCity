import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const decodeSettingValue = (value: unknown) => {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
};

const buildAppSettingFetcher = (client: ReturnType<typeof createClient>) => async (key: string) => {
  try {
    const { data, error } = await client
      .from("app_settings")
      .select("setting_value")
      .eq("key", key)
      .single();

    if (error) {
      throw error;
    }

    return decodeSettingValue(data?.setting_value ?? null);
  } catch (error: any) {
    console.warn(
      `Unable to load app_settings.${key} (row or table may be missing); falling back to defaults.`,
      error?.message || error
    );
    return null;
  }
};

async function waitForProfile(supabase: ReturnType<typeof createClient>, uid: string) {
  for (let i = 0; i < 10; i++) {
    const { data } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('id', uid)
      .maybeSingle();

    if (data?.id) return true;
    // ignore errors briefly; profile may not exist yet
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);

const calculateAge = (dateOfBirth: string) => {
  const dob = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDelta = today.getMonth() - dob.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < dob.getDate())) age -= 1;
  return age;
};

Deno.serve(async (req: Request) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const fetchAppSettingValue = buildAppSettingFetcher(supabase);

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.split('/').pop();

    // /admin-create-user
    if (path === 'admin-create-user' && req.method === 'POST') {
      const body = await req.json();
      const { email, password, role, username } = body;
      const r = String(role || 'user').toLowerCase();
      const allowed = ['admin', 'troll_officer', 'troller', 'user'];
      
      if (!email || !password || !username) {
        return new Response(JSON.stringify({ error: 'Missing email, password or username' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      if (!allowed.includes(r)) {
        return new Response(JSON.stringify({ error: 'Invalid role' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (r === 'admin') {
        const { data: exists } = await supabase
          .from('user_profiles')
          .select('id')
          .eq('role', 'admin')
          .limit(1);
        if ((exists || []).length > 0) {
          return new Response(JSON.stringify({ error: 'Admin already initialized' }), {
            status: 409,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      // 1. Create Auth User
      const { data: created, error: createErr } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { role: r, username: username }
      });

      if (createErr || !created.user) {
        // Handle "User already registered" specifically if needed, but generic error is fine
        return new Response(JSON.stringify({ error: createErr?.message || 'Create failed' }), {
          status: (createErr?.message?.includes('registered') ? 409 : 500),
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const uid = created.user.id;
      // const uname = String(username).trim().slice(0, 20);
      // const avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${uname || email.split('@')[0]}`;
      
      // 2. Wait for trigger to create profile
      const ok = await waitForProfile(supabase, uid);
      if (!ok) {
        return new Response(JSON.stringify({ 
          error: 'Profile was not created by trigger. Check auth.users triggers / handle_user_signup().' 
        }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
      }

      return new Response(JSON.stringify({ success: true, user_id: uid }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // /admin-exists
    if (path === 'admin-exists' && req.method === 'GET') {
      const { data } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('role', 'admin')
        .limit(2);
      const exists = (data || []).length > 0;
      
      return new Response(JSON.stringify({ exists }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // /whoami
    if (path === 'whoami' && req.method === 'GET') {
      const authHeader = req.headers.get('Authorization') || '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
      
      if (!token) {
        return new Response(JSON.stringify({ error: 'Missing token' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data, error } = await supabase.auth.getUser(token);
      if (error || !data?.user) {
        return new Response(JSON.stringify({ error: 'Invalid token' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: true, id: data.user.id, email: data.user.email }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (path === 'create-org-student' && req.method === 'POST') {
      const authHeader = req.headers.get('Authorization') || '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
      if (!token) {
        return new Response(JSON.stringify({ success: false, error: 'Missing token' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: callerData, error: callerError } = await supabase.auth.getUser(token);
      if (callerError || !callerData?.user) {
        return new Response(JSON.stringify({ success: false, error: 'Invalid token' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const body = await req.json();
      const orgId = String(body.org_id || '');
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '');
      const studentName = String(body.student_name || '').trim();
      const dateOfBirth = String(body.date_of_birth || '').trim();

      if (!orgId || !email || !password || !studentName || !dateOfBirth) {
        return new Response(JSON.stringify({ success: false, error: 'Organization, email, password, name, and date of birth are required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: canAdmin } = await supabase.rpc('is_org_admin_member', {
        p_org_id: orgId,
        p_user_id: callerData.user.id,
      });
      const { data: isStaff } = await supabase.rpc('is_tc_staff', { p_user_id: callerData.user.id });
      if (!canAdmin && !isStaff) {
        return new Response(JSON.stringify({ success: false, error: 'You do not have permission to create students for this organization' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: org } = await supabase
        .from('organizations')
        .select('id,status,student_limit,current_student_count')
        .eq('id', orgId)
        .single();
      if (!org || ['suspended', 'dropped'].includes(org.status)) {
        return new Response(JSON.stringify({ success: false, error: 'Organization is not active' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if ((org.current_student_count || 0) >= (org.student_limit || 100)) {
        return new Response(JSON.stringify({ success: false, error: 'Organization has reached its student limit' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const age = calculateAge(dateOfBirth);
      const eighteenthBirthday = new Date(dateOfBirth);
      eighteenthBirthday.setFullYear(eighteenthBirthday.getFullYear() + 18);

      const { data: created, error: createErr } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          username: studentName,
          role: 'student',
          organization_id: orgId,
          is_org_student: true,
          student_date_of_birth: dateOfBirth,
        },
        app_metadata: {
          role: 'student',
          organization_id: orgId,
          is_org_student: true,
        },
      });

      if (createErr || !created.user) {
        return new Response(JSON.stringify({ success: false, error: createErr?.message || 'Failed to create student user' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const studentId = created.user.id;
      const ok = await waitForProfile(supabase, studentId);
      if (!ok) {
        return new Response(JSON.stringify({ success: false, error: 'Student profile was not created by trigger' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      await supabase
        .from('user_profiles')
        .update({
          username: studentName,
          email,
          organization_id: orgId,
          role: 'student',
          is_org_student: true,
          student_date_of_birth: dateOfBirth,
          cashout_locked_until: age < 18 ? eighteenthBirthday.toISOString() : null,
        })
        .eq('id', studentId);

      await supabase.from('organization_students').insert({
        organization_id: orgId,
        user_id: studentId,
        status: 'active',
        date_of_birth: dateOfBirth,
        age_at_enrollment: age,
        is_verified_18_plus: age >= 18,
        created_by: callerData.user.id,
        student_email: email,
        student_name: studentName,
        cashout_locked_until_18: age < 18,
      });

      await supabase.from('organization_members').upsert({
        org_id: orgId,
        user_id: studentId,
        role: 'viewer',
        status: 'active',
        invited_by: callerData.user.id,
        joined_at: new Date().toISOString(),
      }, { onConflict: 'org_id,user_id' });

      await supabase.from('organization_audit_logs').insert({
        org_id: orgId,
        actor_id: callerData.user.id,
        action: 'student_account_created',
        target_type: 'organization_student',
        target_id: studentId,
        metadata: { email, student_name: studentName, age_at_enrollment: age, cashout_locked_until_18: age < 18 },
      });

      return new Response(JSON.stringify({ success: true, user_id: studentId, cashout_locked_until_18: age < 18 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (path === 'logout' && req.method === 'POST') {
      return new Response(JSON.stringify({ message: 'Logged out.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (path === 'delete-account' && req.method === 'POST') {
      const authHeader = req.headers.get('Authorization') || '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

      if (!token) {
        return new Response(JSON.stringify({ error: 'Missing token' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data, error } = await supabase.auth.getUser(token);
      if (error || !data?.user) {
        return new Response(JSON.stringify({ error: 'Invalid token' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const userId = data.user.id;

      const { error: authError } = await supabase.auth.admin.deleteUser(userId);
      if (authError) {
        return new Response(JSON.stringify({ error: authError.message || 'Failed to delete auth user' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { error: profileError } = await supabase
        .from('user_profiles')
        .delete()
        .eq('id', userId);

      if (profileError) {
        return new Response(JSON.stringify({ error: profileError.message || 'Failed to delete profile' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (path === 'fix-admin-role' && req.method === 'POST') {
      const authHeader = req.headers.get('Authorization') || '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
      
      if (!token) {
        return new Response(JSON.stringify({ error: 'Missing token' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data, error } = await supabase.auth.getUser(token);
      if (error || !data?.user) {
        return new Response(JSON.stringify({ error: 'Invalid token' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const adminEmail = (Deno.env.get('VITE_ADMIN_EMAIL') || 'trollcity2025@gmail.com').trim().toLowerCase();
      const userEmail = String(data.user.email || '').trim().toLowerCase();

      if (userEmail !== adminEmail) {
        return new Response(JSON.stringify({ error: 'Not admin email' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: existingProfile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (!existingProfile) {
        return new Response(JSON.stringify({ error: 'Profile not found' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (existingProfile.role !== 'admin') {
        await supabase
          .from('user_profiles')
          .update({ role: 'admin', updated_at: new Date().toISOString() })
          .eq('id', data.user.id);
        
        return new Response(JSON.stringify({ success: true, profile: { ...existingProfile, role: 'admin' } }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: true, profile: existingProfile }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // /signup - No auth required (user doesn't exist yet)
    // This endpoint uses service role key internally, so no user auth needed
     if (path === 'signup' && req.method === 'POST') {
       const body = await req.json();
       const { email, password, username, referral_code, role, organization_data, org_password } = body;
       if (!email || !password || !username) {
         return new Response(JSON.stringify({ error: 'Missing email, password or username' }), {
           status: 400,
           headers: { ...corsHeaders, 'Content-Type': 'application/json' },
         });
       }





        // Get allowed emails from env for role validation
        const ADMIN_EMAIL = (Deno.env.get('VITE_ADMIN_EMAIL') || 'trollcity2025@gmail.com').trim().toLowerCase()
        const STAFF_EMAILS = (Deno.env.get('VITE_STAFF_EMAILS') || '').split(',').map((e: string) => e.trim().toLowerCase()).filter(Boolean)

        // Always resolve role name for user_profiles (text only)
        const requestedRole = String(role || 'user').toLowerCase()

        // Extract organization data (if signing up as organization)
        const orgData = body.organization_data || null

        // Validate email-to-role mapping
        const cleanEmail = email.trim().toLowerCase()
        if (requestedRole === 'admin' && cleanEmail !== ADMIN_EMAIL) {
          return new Response(JSON.stringify({ error: `Only the admin email (${ADMIN_EMAIL}) can sign up as admin` }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        if (requestedRole === 'staff' && !STAFF_EMAILS.includes(cleanEmail)) {
          return new Response(JSON.stringify({ error: `Your email is not authorized for staff role. Allowed: ${STAFF_EMAILS.join(', ')}` }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        // Organization signup validations
        if (requestedRole === 'organization') {
          if (!orgData) {
            return new Response(JSON.stringify({ error: 'Organization data is required' }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
          }
          if (!orgData.name?.trim()) {
            return new Response(JSON.stringify({ error: 'Organization name is required' }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
          }
          if (!orgData.email?.trim()) {
            return new Response(JSON.stringify({ error: 'Organization business email is required' }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
          }
           if (!password || password.length < 6) {
             return new Response(JSON.stringify({ error: 'Organization password is required and must be at least 6 characters' }), {
               status: 400,
               headers: { ...corsHeaders, 'Content-Type': 'application/json' }
             })
           }
          // Validate business email (no personal)
          const orgCleanEmail = orgData.email.trim().toLowerCase()
          if (
            orgCleanEmail.includes('@gmail.com') ||
            orgCleanEmail.includes('@yahoo.com') ||
            orgCleanEmail.includes('@hotmail.com') ||
            orgCleanEmail.includes('@outlook.com')
          ) {
            return new Response(JSON.stringify({ error: 'Personal email addresses are not allowed for organizations. Please use a business email.' }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
          }
        }

        // Handle joining existing org (for regular users)
        const joinOrgId = body.organization_id || null
        if (joinOrgId) {
          const { count } = await supabase
            .from('organizations')
            .select('*', { count: 'exact', head: true })
            .eq('id', joinOrgId)
            .in('status', ['active', 'approved'])
          if (!count) {
            return new Response(JSON.stringify({ error: 'Selected organization not found or not approved' }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
          }
        }

        const trimmedUsername = username.trim();
        
         // Build user metadata
         const userMetadata: any = {
           username: trimmedUsername,
           is_test_user: false,
           role: requestedRole
         }

        // If joining existing org (regular user), store org_id in metadata
        if (joinOrgId && requestedRole === 'user') {
          userMetadata.organization_id = joinOrgId
        }

        const { data: created, error: createErr } = await supabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: userMetadata,
          app_metadata: userMetadata
        });

      if (createErr || !created.user) {
        return new Response(JSON.stringify({ error: createErr?.message || 'Failed to create user' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const uid = created.user.id;
      // const avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${trimmedUsername}`;


        // Wait for trigger to create profile
        const ok = await waitForProfile(supabase, uid);
        if (!ok) {
          return new Response(JSON.stringify({ 
            error: 'Profile was not created by trigger. Check auth.users triggers / handle_user_signup().' 
          }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
        }

        // If organization signup: create the organization and link it to the user
        if (requestedRole === 'organization' && orgData) {
          try {
            // 1. Create the organization
            const { data: newOrg, error: orgError } = await supabase
              .from('organizations')
              .insert({
                name: orgData.name.trim(),
                slug: slugify(orgData.name.trim()),
                email: orgData.email.trim(),
                phone: orgData.phone?.trim() || null,
                website: orgData.website?.trim() || null,
                country: orgData.country?.trim(),
                description: orgData.description?.trim(),
                org_type: orgData.org_type || 'program',
                primary_contact_name: trimmedUsername,
                primary_contact_email: orgData.email.trim(),
                primary_contact_phone: orgData.phone?.trim() || null,
                status: 'onboarding',
                student_limit: 100,
                current_student_count: 0,
                admin_user_id: uid,
                created_by: uid,
                assigned_admin_id: null,
                is_public: false,
                password: password // store org password (TODO: hash)
              })
              .select('id')
              .single()

            if (orgError || !newOrg) {
              throw new Error(orgError?.message || 'Failed to create organization')
            }

            // 2. Update user profile to set organization_id and change role to 'org_admin' or keep as org?
            // Update the newly created user profile to reference this org and set proper role
            await supabase
              .from('user_profiles')
              .update({
                organization_id: newOrg.id,
                role: 'org_admin' // or keep as 'organization'?
              })
              .eq('id', uid)

            // 3. Add the user as an organization admin
            await supabase
              .from('organization_admins')
              .insert({
                user_id: uid,
                organization_id: newOrg.id,
                role: 'owner',
                added_by: uid,
                permissions: { full: true }
              })

            await supabase
              .from('organization_members')
              .upsert({
                org_id: newOrg.id,
                user_id: uid,
                role: 'org_admin',
                status: 'active',
                invited_by: uid,
                joined_at: new Date().toISOString()
              }, { onConflict: 'org_id,user_id' })

            await supabase
              .from('organization_audit_logs')
              .insert({
                org_id: newOrg.id,
                actor_id: uid,
                action: 'organization_created',
                target_type: 'organization',
                target_id: newOrg.id,
                metadata: { signup: true, name: orgData.name.trim() }
              })

            // Note: Organization requires admin approval before being publicly listed
          } catch (orgErr: any) {
            console.error('[Org creation error]', orgErr)
            return new Response(JSON.stringify({ error: `Organization creation failed: ${orgErr.message}` }), {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
          }
        }

         // If user selected an organization and is a regular user (not admin/staff), auto-join that org
         if (joinOrgId && requestedRole === 'user') {
            try {
              // Check org capacity
              const { count: currentCount } = await supabase
                .from('organization_students')
                .select('*', { count: 'exact', head: true })
                .eq('organization_id', joinOrgId)
                .eq('status', 'active')
              
              const { data: orgData } = await supabase
                .from('organizations')
                .select('student_limit')
                .eq('id', joinOrgId)
                .single()
              
              const studentLimit = orgData?.student_limit || 100
              
              if (currentCount !== null && currentCount >= studentLimit) {
                return new Response(JSON.stringify({ error: 'Organization has reached its student limit' }), {
                  status: 400,
                  headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
              }
              
              // Add to organization_students
              const { error: membershipError } = await supabase
                .from('organization_students')
                .insert({
                  user_id: uid,
                  organization_id: joinOrgId,
                  status: 'active'
                })
              
              if (membershipError) {
                console.error('Failed to add user to organization:', membershipError)
              }
            } catch (orgErr) {
              console.error('Organization join error:', orgErr)
              // Don't fail signup if org join fails — user can join later
            }
          }



      // Handle referral code if provided
      if (referral_code) {
        try {
          const { data: handled, error: referralRpcError } = await supabase.rpc('handle_referral_signup', {
            p_user_id: uid,
            p_referral_code: String(referral_code),
          });

          if (referralRpcError) {
            console.error('Error calling handle_referral_signup:', referralRpcError);
          }

          if (!handled) {
            const { data: recruiterProfile } = await supabase
              .from('user_profiles')
              .select('id')
              .eq('id', referral_code)
              .maybeSingle();

            if (recruiterProfile && recruiterProfile.id !== uid) {
              await supabase
                .from('user_profiles')
                .update({
                  referred_by_user_id: recruiterProfile.id,
                  referred_user_bonus_active: true,
                })
                .eq('id', uid)
                .is('referred_by_user_id', null);

              const { error: referralError } = await supabase
                .from('referrals')
                .insert({
                  referrer_id: recruiterProfile.id,
                  recruiter_id: recruiterProfile.id,
                  referred_user_id: uid,
                  referred_at: new Date().toISOString(),
                  reward_status: 'pending',
                  deadline: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString()
                });

              if (referralError) {
                console.error('Error creating referral:', referralError);
              }
            }
          }
        } catch (error) {
          console.error('Error processing referral code:', error);
          // Don't fail signup if referral processing fails
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    let message = 'Unknown error';
    if (error) {
      if (typeof error === 'string') {
        message = error;
      } else if (error.message) {
        message = error.message;
      } else if (error.toString) {
        message = error.toString();
      }
    }
    return new Response(JSON.stringify({
      error: message,
      details: error
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
})
