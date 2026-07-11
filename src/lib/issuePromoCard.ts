import { supabase } from './supabase'

export interface IssuePromoCardOptions {
  user_id: string
  source_type: 'broadcast_start' | 'broadcast_watch' | 'share_link'
  token_amount: number
  metadata?: Record<string, unknown>
}

export interface IssuePromoCardResult {
  success: boolean
  promo_card_id: string | null
  code: string | null
  token_amount: number | null
  expires_at: string | null
  next_available_at: string | null
  message: string
  error?: string
}

export async function issuePromoCard(options: IssuePromoCardOptions): Promise<IssuePromoCardResult> {
  try {
    const { data, error } = await supabase.rpc('issue_promo_card', {
      p_user_id: options.user_id,
      p_source_type: options.source_type,
      p_token_amount: options.token_amount,
      p_metadata: options.metadata ?? {},
    })

    if (error) {
      return {
        success: false,
        promo_card_id: null,
        code: null,
        token_amount: null,
        expires_at: null,
        next_available_at: null,
        message: '',
        error: error.message || 'Failed to issue promo card',
      }
    }

    const result = data as any

    if (!result || typeof result !== 'object') {
      return {
        success: false,
        promo_card_id: null,
        code: null,
        token_amount: null,
        expires_at: null,
        next_available_at: null,
        message: '',
        error: 'Empty response from server',
      }
    }

    const promoCardId = result.promo_card_id as string | null

    if (!promoCardId) {
      return {
        success: false,
        promo_card_id: null,
        code: null,
        token_amount: null,
        expires_at: result.expires_at ?? null,
        next_available_at: result.next_available_at ?? null,
        message: result.message || 'Cooldown active',
        error: 'COOLDOWN_ACTIVE',
      }
    }

    return {
      success: true,
      promo_card_id: promoCardId,
      code: result.code,
      token_amount: result.token_amount,
      expires_at: result.expires_at,
      next_available_at: null,
      message: result.message || 'Promo card issued',
    }
  } catch (error: any) {
    return {
      success: false,
      promo_card_id: null,
      code: null,
      token_amount: null,
      expires_at: null,
      next_available_at: null,
      message: '',
      error: error?.message || 'Unexpected error issuing promo card',
    }
  }
}
