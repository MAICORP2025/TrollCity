import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { handleCorsPreflight, withCors } from '../_shared/cors.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return handleCorsPreflight(req);
  }

  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return withCors({ error: 'Unauthorized' }, 401, req);
    }

    const adminKey = Deno.env.get('AGENCY_CRON_SECRET');
    if (adminKey) {
      const providedKey = req.headers.get('x-cron-secret');
      if (providedKey !== adminKey) {
        return withCors({ error: 'Forbidden: Invalid cron secret' }, 403, req);
      }
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: settings, error: settingsError } = await supabase
      .from('agency_settings')
      .select('value')
      .eq('key', 'point_values')
      .maybeSingle();

    if (settingsError) {
      console.error('[Agency Weekly] Failed to load settings:', settingsError);
    }

    const { data: results, error: evalError } = await supabase.rpc('run_weekly_agency_evaluation');

    if (evalError) {
      console.error('[Agency Weekly] Evaluation failed:', evalError);
      return withCors({ error: 'Evaluation failed', details: evalError.message }, 500, req);
    }

    const summary = {
      total_evaluated: results?.length || 0,
      promotions: results?.filter((r: any) => r.tier_changed && r.new_tier > r.previous_tier).length || 0,
      demotions: results?.filter((r: any) => r.tier_changed && r.new_tier < r.previous_tier).length || 0,
      total_points_awarded: results?.reduce((sum: number, r: any) => sum + (r.total_points || 0), 0) || 0,
      evaluated_at: new Date().toISOString(),
      details: results || [],
    };

    const { error: notifError } = await supabase.from('notifications').insert(
      (results || [])
        .filter((r: any) => r.tier_changed)
        .map((r: any) => ({
          user_id: r.user_id,
          type: 'agency_tier_change',
          title: r.new_tier > r.previous_tier ? 'Tier Promotion!' : 'Tier Update',
          message: r.new_tier > r.previous_tier
            ? `Congratulations! You've been promoted to ${r.new_tier} tier!`
            : `Your tier has been updated to ${r.new_tier}.`,
          metadata: { previous_tier: r.previous_tier, new_tier: r.new_tier, week_points: r.total_points },
        }))
    );

    if (notifError) {
      console.error('[Agency Weekly] Failed to create notifications:', notifError);
    }

    console.log('[Agency Weekly] Evaluation complete:', {
      evaluated: summary.total_evaluated,
      promotions: summary.promotions,
      demotions: summary.demotions,
    });

    return withCors({ success: true, summary }, 200, req);
  } catch (err) {
    console.error('[Agency Weekly] Unexpected error:', err);
    return withCors({ error: 'Internal server error', details: err instanceof Error ? err.message : 'Unknown' }, 500, req);
  }
});
