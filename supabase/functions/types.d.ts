declare module 'jsr:@supabase/supabase-js@2' {
  export function createClient(url: string, key: string): any
  export interface SupabaseClient {}
}

declare module 'jsr:@supabase/functions-js/edge-runtime.d.ts' {}
