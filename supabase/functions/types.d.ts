// Deno global types
declare namespace Deno {
  namespace env {
    function get(key: string): string | undefined;
  }
  function serve(handler: (req: Request) => Response | Promise<Response>): void;
}

// Supabase types
declare module 'jsr:@supabase/supabase-js@2' {
  export function createClient(url: string, key: string, options?: any): any
  export interface SupabaseClient {}
}

declare module 'jsr:@supabase/functions-js/edge-runtime.d.ts' {}
