import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load env vars
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase URL or Service Key');
    process.exit(1);
}

const adminClient = createClient(supabaseUrl, supabaseServiceKey);

const gifts = [
    { slug: 'rose', name: 'Rose', cost: 5, icon_url: 'rose.png' },
    { slug: 'coffee', name: 'Coffee', cost: 10, icon_url: 'coffee.png' },
    { slug: 'dragon', name: 'Dragon', cost: 100, icon_url: 'dragon.png' }
];

async function seedGifts() {
    console.log('Seeding gifts...');
    
    for (const gift of gifts) {
        const { error } = await adminClient
            .from('gifts')
            .upsert(gift, { onConflict: 'slug' });
            
        if (error) {
            console.error(`Error seeding ${gift.slug}:`, error);
        } else {
            console.log(`Seeded ${gift.slug}`);
        }
    }
    console.log('Done.');
}

seedGifts();
