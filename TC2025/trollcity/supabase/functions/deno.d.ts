// Type definitions for Deno runtime
declare global {
  namespace Deno {
    const env: {
      get(key: string): string | undefined;
    };
  }
}

// Mock type definitions for Deno imports
declare module 'https://deno.land/std@0.168.0/http/server.ts' {
  export function serve(handler: (req: Request) => Promise<Response>): void;
}

declare module 'https://esm.sh/@supabase/supabase-js@2' {
  export interface SupabaseClient {
    auth: {
      getUser(): Promise<{ data: { user: any } }>;
    };
    from(table: string): {
      select(query: string): {
        eq(column: string, value: any): {
          single(): Promise<{ data: any; error?: any }>;
        };
      };
      update(data: any): {
        eq(column: string, value: any): Promise<{ error?: any }>;
      };
      insert(data: any): Promise<{ error?: any }>;
      upsert(data: any): Promise<{ error?: any }>;
    };
    rpc(name: string, params: any): Promise<{ error?: any }>;
  }
  
  export function createClient(url: string, key: string, options?: any): SupabaseClient;
}

export {};