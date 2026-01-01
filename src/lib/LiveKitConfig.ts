// LiveKit configuration with environment variable validation

// Primary LiveKit URL from environment variables
const primaryUrl = import.meta.env.VITE_LIVEKIT_URL
const fallbackUrl = import.meta.env.VITE_LIVEKIT_CLOUD_URL

// Debug logging at app load
console.log("✅ VITE_LIVEKIT_URL:", primaryUrl)
console.log("✅ VITE_LIVEKIT_CLOUD_URL:", fallbackUrl)

// Determine the final LiveKit URL with fallback and validation
let LIVEKIT_URL: string

if (primaryUrl) {
  LIVEKIT_URL = primaryUrl
} else if (fallbackUrl) {
  LIVEKIT_URL = fallbackUrl
  console.warn("⚠️  Using fallback LiveKit URL from VITE_LIVEKIT_CLOUD_URL")
} else {
  const errorMsg = "❌ CRITICAL: No LiveKit URL configured. Set VITE_LIVEKIT_URL or VITE_LIVEKIT_CLOUD_URL environment variables."
  console.error(errorMsg)
  throw new Error(errorMsg)
}

// Validate URL format
if (!LIVEKIT_URL.startsWith('wss://')) {
  const errorMsg = `❌ CRITICAL: Invalid LiveKit URL format: ${LIVEKIT_URL}. Must start with 'wss://'`
  console.error(errorMsg)
  throw new Error(errorMsg)
}

// Final debug log
console.log("✅ LIVEKIT_URL FINAL:", LIVEKIT_URL)

// Export the validated and configured LiveKit URL
export { LIVEKIT_URL }

export const defaultLiveKitOptions = {
  adaptiveStream: true,
  dynacast: true,
  stopLocalTrackOnUnpublish: true
};