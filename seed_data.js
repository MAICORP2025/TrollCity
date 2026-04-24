const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseKey) {
  throw new Error('SUPABASE_ANON_KEY environment variable is required');
}

const supabase = createClient(supabaseUrl, supabaseKey);

const seedSQL = `
INSERT INTO entrance_effects (id, name, icon, coin_cost, rarity, description) VALUES
  ('effect_flame_burst', '🔥 Flame Burst', '🔥', 500, 'Rare', 'Enter with flames')
ON CONFLICT (id) DO NOTHING;
`;

async function seedData() {
  try {
    console.log('Seeding data...');
    const result = await supabase.rpc('execute_sql', { sql: seedSQL });
    if (result.error) throw result.error;
    console.log('✅ Data seeded!');
  } catch (error) {
    console.error('Error:', error);
  }
}

seedData();
