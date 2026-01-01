/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_APP_TITLE: string
    readonly VITE_APP_BASE_URL: string
    readonly VITE_SUPABASE_URL: string
    readonly VITE_SUPABASE_ANON_KEY: string
    readonly VITE_LIVEKIT_URL: string
    readonly VITE_LIVEKIT_API_KEY: string
    readonly VITE_LIVEKIT_API_SECRET: string
    // Add more env variables as needed
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}
