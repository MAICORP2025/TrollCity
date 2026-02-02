import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseKey) {
  throw new Error('SUPABASE_ANON_KEY environment variable is required');
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seedData() {
  try {
    console.log('Seeding data...');
    
    const effects = [
      { id: 'effect_flame_burst', name: '🔥 Flame Burst', icon: '🔥', coin_cost: 500 },
      { id: 'effect_money_shower', name: '💸 Money Shower', icon: '💸', coin_cost: 1500 }
    ];

    for (const effect of effects) {
      await supabase.from('entrance_effects').upsert(effect, { onConflict: 'id' });
    }
    
    console.log('✅ Data seeded!');
  } catch (error) {
    console.error('Error:', error);
  }
}

seedData();
