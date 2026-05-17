export const PURCHASE_REQUIRED_MESSAGE = 'Purchase required to use this feature'

export function isPurchaseRequiredErrorMessage(value?: string) {
  if (!value) return false
  return value.includes(PURCHASE_REQUIRED_MESSAGE)
}

export function getPurchaseErrorStatus(error: any) {
  if (error?.status === 403) return 403
  if (isPurchaseRequiredErrorMessage(error?.message) || isPurchaseRequiredErrorMessage(error?.error)) {
    return 403
  }
  return 500
}
