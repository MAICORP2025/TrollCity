// Comprehensive type definitions for Deno-based Supabase Edge Functions

// Global type declarations for Deno runtime
declare global {
  // Deno namespace
  namespace Deno {
    const env: {
      get(key: string): string | undefined;
    };
  }

  // Web API types that Deno provides
  interface Request {
    method: string;
    headers: Headers;
    json(): Promise<any>;
    text(): Promise<string>;
  }

  interface Response {
    constructor(body?: BodyInit | null, init?: ResponseInit);
    readonly headers: Headers;
    readonly ok: boolean;
    readonly redirected: boolean;
    readonly status: number;
    readonly statusText: string;
    readonly type: ResponseType;
    readonly url: string;
  }

  interface ResponseInit {
    headers?: HeadersInit;
    status?: number;
    statusText?: string;
  }

  type HeadersInit = string[][] | Record<string, string> | string;
  type BodyInit = string | Uint8Array | ArrayBuffer;
  type ResponseType = "basic" | "cors" | "default" | "error" | "opaque" | "opaqueredirect";

  // Console API
  interface Console {
    log(...args: any[]): void;
    error(...args: any[]): void;
    warn(...args: any[]): void;
    info(...args: any[]): void;
    debug(...args: any[]): void;
  }

  declare var console: Console;

  // Fetch API
  interface FetchResponse extends Response {
    json(): Promise<any>;
    text(): Promise<string>;
    ok: boolean;
    status: number;
    statusText: string;
  }

  declare function fetch(url: string, init?: any): Promise<FetchResponse>;

  // Headers API
  interface Headers {
    append(name: string, value: string): void;
    delete(name: string): void;
    get(name: string): string | null;
    has(name: string): boolean;
    set(name: string, value: string): void;
  }

  // JSON API
  interface JSON {
    stringify(value: any, replacer?: (key: string, value: any) => any, space?: string | number): string;
    parse(text: string, reviver?: (key: string, value: any) => any): any;
  }

  declare var JSON: JSON;
}

// Module declarations for Deno imports
declare module 'https://deno.land/std@0.168.0/http/server.ts' {
  export function serve(handler: (req: Request) => Promise<Response>): void;
}

declare module 'https://esm.sh/@supabase/supabase-js@2' {
  export interface SupabaseClient {
    auth: {
      getUser(): Promise<{ data: { user: any } }>;
    };
    from(table: string): {
      select(query?: string): {
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