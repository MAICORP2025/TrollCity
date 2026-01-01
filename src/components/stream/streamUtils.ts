export function connectionStatusLabel(isConnected: boolean, isConnecting: boolean, error?: any): string {
  if (error) return 'Error'
  if (isConnected) return 'Connected'
  if (isConnecting) return 'Connecting'
  return 'Disconnected'
}
