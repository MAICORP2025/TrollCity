import { useContext } from 'react'
import { BatterySaverContext } from '../contexts/BatterySaverContext'

export function useBatterySaver() {
  const context = useContext(BatterySaverContext)
  if (!context) {
    throw new Error('useBatterySaver must be used within BatterySaverProvider')
  }
  return context
}
