export interface PromoCodeValidationResult {
  valid: boolean
  code: string
  reason?: string
  tokenAmount?: number
  sourceType?: string
  status?: string
  expiresAt?: string | null
}

export function validatePromoCardLocally(card: {
  code: string
  status: string
  expires_at: string | null
}): PromoCodeValidationResult {
  const now = Date.now()
  const expired = card.status === 'expired' || (!!card.expires_at && new Date(card.expires_at).getTime() <= now)

  if (card.status === 'redeemed') {
    return { valid: false, code: card.code, reason: 'already redeemed' }
  }
  if (expired) {
    return { valid: false, code: card.code, reason: 'expired' }
  }
  return { valid: true, code: card.code, reason: undefined }
}

export function buildRedeemRequestBody(code: string, accountId: string) {
  return {
    code: code.trim(),
    requestor: { platform: 'maitalent.fun', accountId },
  }
}
