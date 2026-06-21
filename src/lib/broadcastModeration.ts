export function isBroadcastChatLockActive({
  disabled,
  until,
  streamId,
  lockedStreamId,
}: {
  disabled?: boolean | null
  until?: string | null
  streamId?: string | null
  lockedStreamId?: string | null
}) {
  if (!disabled) return false
  if (streamId && lockedStreamId && lockedStreamId !== streamId) return false

  if (until) {
    const expiresAt = Date.parse(until)
    if (!Number.isNaN(expiresAt)) return expiresAt > Date.now()
  }

  return true
}

export function getBroadcastChatLockRemainingMs(until?: string | null) {
  if (!until) return 0

  const expiresAt = Date.parse(until)
  if (Number.isNaN(expiresAt)) return 0

  return Math.max(0, expiresAt - Date.now())
}
