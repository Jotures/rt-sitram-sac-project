import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readSupabaseConfiguration } from "./config";
import type { Database } from "./database.types";

export const supabaseConfiguration = readSupabaseConfiguration(import.meta.env);

export const browserAuthOptions = {
  persistSession: true,
  autoRefreshToken: true,
  detectSessionInUrl: true,
} as const;

// This module is the single controlled creation point for the browser client.
// VITE_* values are public by design; secret and service_role keys never belong here.
export const supabaseClient: SupabaseClient<Database> | null =
  supabaseConfiguration.status === "CONFIGURED"
    ? createClient<Database>(
        supabaseConfiguration.config.url,
        supabaseConfiguration.config.publishableKey,
        {
          // Auth callback detection exchanges only Supabase-issued invite/recovery
          // credentials. The callback page removes them from browser history once
          // initialization finishes.
          auth: browserAuthOptions,
        },
      )
    : null;

export function getSupabaseClient(): SupabaseClient<Database> | null {
  return supabaseClient;
}
