import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { withCors, handleCorsPreflight } from '../_shared/cors.ts';
import { supabase } from '../_shared/supabaseClient.ts';

interface RedeemPromoRequest {
  code: string;
  requestor?: {
    platform?: string;
    accountId?: string;
    metadata?: Record<string, unknown>;
  };
}

const AUTH_TOKEN = Deno.env.get('TROLLCITY_PROMO_API_KEY')
  || Deno.env.get('TROLLCITY_SERVICE_TOKEN')
  || Deno.env.get('TROLL_CITY_PROMO_SECRET');

function extractBearerToken(headerValue: string | null): string | null {
  if (!headerValue) return null;
  const trimmed = headerValue.trim();
  if (trimmed.toLowerCase().startsWith('bearer ')) {
    return trimmed.slice(7).trim();
  }
  return trimmed;
}

function unauthorizedResponse() {
  return withCors({ success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return handleCorsPreflight(req);
  }

  if (req.method !== 'POST') {
    return withCors({ success: false, error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }, 405, req);
  }

  if (!AUTH_TOKEN) {
    console.error('[redeem-maitalent-promo] Missing auth token configuration');
    return withCors({ success: false, error: 'Server not configured', code: 'SERVER_ERROR' }, 500, req);
  }

  const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
  const apiKeyHeader = req.headers.get('x-api-key');
  const token = extractBearerToken(authHeader) || apiKeyHeader;

  if (!token || token !== AUTH_TOKEN) {
    return unauthorizedResponse();
  }

  let body: RedeemPromoRequest;
  let rawBody = '';

  try {
    rawBody = await req.text();
  } catch (error) {
    return withCors({ success: false, error: 'Invalid JSON request body', code: 'INVALID_REQUEST', rawBody }, 400, req);
  }

  if (!rawBody || !rawBody.trim()) {
    return withCors({ success: false, error: 'Invalid JSON request body', code: 'INVALID_REQUEST', rawBody }, 400, req);
  }

  try {
    body = JSON.parse(rawBody) as RedeemPromoRequest;
  } catch (error) {
    return withCors({ success: false, error: 'Invalid JSON request body', code: 'INVALID_REQUEST', rawBody }, 400, req);
  }

  if (!body?.code || typeof body.code !== 'string') {
    return withCors({ success: false, error: 'Missing promo code', code: 'INVALID_REQUEST' }, 400, req);
  }

  const requestorPlatform = body.requestor?.platform?.trim() || null;
  const requestorAccountId = body.requestor?.accountId?.trim() || null;
  const requestorMetadata = body.requestor?.metadata || null;

  const { data, error } = await supabase.rpc('redeem_promo_card', {
    p_code: body.code.trim(),
    p_requestor_platform: requestorPlatform,
    p_requestor_account_id: requestorAccountId,
    p_requestor_metadata: requestorMetadata ? requestorMetadata : null,
  });

  if (error) {
    console.error('[redeem-maitalent-promo] RPC error:', error.message);
    return withCors({ success: false, error: 'Server error', code: 'SERVER_ERROR' }, 500, req);
  }

  const result = data as Record<string, unknown> | null;
  if (!result) {
    return withCors({ success: false, error: 'Empty response from redemption service', code: 'SERVER_ERROR' }, 500, req);
  }

  const success = result.success === true;
  if (!success) {
    return withCors({
      success: false,
      error: String(result.error ?? 'Invalid promo code'),
      code: String(result.code ?? 'INVALID_CODE'),
    }, 400, req);
  }

  return withCors({
    success: true,
    code: String(result.code ?? body.code.trim()),
    tokenAmount: Number(result.tokenAmount ?? 0),
    promoId: String(result.promoId ?? ''),
    status: String(result.status ?? 'redeemed'),
    redeemedAt: String(result.redeemedAt ?? new Date().toISOString()),
  }, 200, req);
});
