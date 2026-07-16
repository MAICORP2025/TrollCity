declare const __APP_VERSION__: string
declare const __BUILD_TIME__: string

declare global {
  interface ImportMetaEnv {
    readonly VITE_SUPABASE_URL: string
    readonly VITE_SUPABASE_ANON_KEY: string
    readonly VITE_EDGE_FUNCTIONS_URL: string
    readonly VITE_ADMIN_EMAIL?: string
    readonly VITE_STAFF_EMAILS?: string
    readonly VITE_CEO_EMAIL?: string
    readonly DEV: boolean
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv
  }
}

export {}
