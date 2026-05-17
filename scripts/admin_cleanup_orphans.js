
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

dotenv.config()

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing env vars')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
})

async function cleanupOrphans() {
  console.log('Starting orphan cleanup...')
  let page = 1;
  const perPage = 50;
  let deletedCount = 0;
  let errorCount = 0;
  let checkedCount = 0;

  try {
    while (true) {
        const { data: { users }, error } = await supabase.auth.admin.listUsers({
            page: page,
            perPage: perPage
        });

        if (error) {
            console.error('Error fetching users:', error);
            break;
        }

        if (!users || users.length === 0) {
            break;
        }

        console.log(`Checking batch ${page} (${users.length} users)...`);

        for (const user of users) {
            checkedCount++;
            // Check if profile exists
            const { data: profile, error: _pErr } = await supabase
                .from('user_profiles')
                .select('id')
                .eq('id', user.id)
                .single();

            if (!profile) {
                console.log(`🗑️ Orphan found: ${user.email} (${user.id}). Deleting...`);
                const { error: dErr } = await supabase.auth.admin.deleteUser(user.id);
                if (dErr) {
                    console.error(`❌ Failed to delete ${user.id}:`, dErr.message);
                    errorCount++;
                } else {
                    console.log(`✅ Deleted.`);
                    deletedCount++;
                }
            }
        }

        if (users.length < perPage) {
            break;
        }
        page++;
    }

    console.log('--- Cleanup Complete ---');
    console.log(`Total Checked: ${checkedCount}`);
    console.log(`Deleted Orphans: ${deletedCount}`);
    console.log(`Errors: ${errorCount}`);

  } catch (e) {
    console.error('Unexpected error:', e)
  }
}

cleanupOrphans()
