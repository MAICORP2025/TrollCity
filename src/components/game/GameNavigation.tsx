import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

/**
 * Custom hook for game navigation with additional game-specific features
 * Wraps react-router-dom's useNavigate for consistency across game components
 */
export function useGameNavigate() {
  const navigate = useNavigate()

  const gameNavigate = useCallback(
    (path: string, options?: { replace?: boolean; state?: Record<string, unknown> }) => {
      navigate(path, {
        replace: options?.replace ?? false,
        state: options?.state,
      })
    },
    [navigate]
  )

  return gameNavigate
}

export default useGameNavigate
