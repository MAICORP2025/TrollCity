// Quick script to apply the user_id fix migration
const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  port: 54322,
  user: 'postgres',
  password: 'postgres',
  database: 'postgres',
});

async function main() {
  try {
    await client.connect();
    console.log('Connected to database');

    // Update handle_new_user_profile function
    await client.query(`
      CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
      RETURNS TRIGGER
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public
      AS $$
      begin
        insert into public.user_profiles (id, user_id, email)
        values (new.id, new.id, new.email)
        on conflict (id) do update set email = excluded.email;
        return new;
      end;
      $$;
    `);
    console.log('Updated handle_new_user_profile function');

    // Update handle_new_user_troll_coins function
    await client.query(`
      CREATE OR REPLACE FUNCTION public.handle_new_user_troll_coins()
      RETURNS TRIGGER
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public, extensions
      AS $$
      BEGIN
        INSERT INTO public.user_profiles (id, user_id, troll_coins)
        VALUES (NEW.id, NEW.id, 500)
        ON CONFLICT (id)
        DO UPDATE SET troll_coins = COALESCE(user_profiles.troll_coins, 500);
        RETURN NEW;
      END;
      $$;
    `);
    console.log('Updated handle_new_user_troll_coins function');

    // Update existing user_profiles to set user_id where it's NULL
    await client.query(`
      UPDATE public.user_profiles
      SET user_id = id
      WHERE user_id IS NULL;
    `);
    console.log('Updated existing user_profiles with NULL user_id');

    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
