import { useLockdown } from './useLockdown'

export function useHytroGamingLockdown() {
  return useLockdown(
    'hytro_gaming_lockdown_enabled',
    'Controls whether HytroGaming streaming is disabled for all users'
  )
}

export function usePodcastLockdown() {
  return useLockdown(
    'podcast_lockdown_enabled',
    'Controls whether podcasts are disabled for all users'
  )
}
