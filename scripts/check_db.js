
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase URL or Anon Key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkGarage() {
  console.log('Checking garage (deep scan)...');

  // Check ANY user vehicles
  const { data: vehicles, error: vError } = await supabase
    .from('user_vehicles')
    .select(`
      *,
      vehicles_catalog (name),
      vehicle_registrations (plate_number),
      vehicle_titles (status),
      vehicle_insurance_policies (status)
    `)
    .limit(5);

  if (vError) {
    console.error('Error fetching vehicles:', vError);
  } else {
    console.log(`Found ${vehicles.length} vehicles in user_vehicles (total sample).`);
    vehicles.forEach(v => {
      console.log(`- User ${v.user_id} owns ${v.vehicles_catalog?.name}`);
      console.log(`  Registration: ${JSON.stringify(v.vehicle_registrations)}`);
    });
  }
}

checkGarage();
