import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readSupabaseConfiguration } from "./config";

export const supabaseConfiguration = readSupabaseConfiguration(import.meta.env);

// This module is the single controlled creation point for the browser client.
// VITE_* values are public by design; secret and service_role keys never belong here.
export const supabaseClient: SupabaseClient | null =
  supabaseConfiguration.status === "CONFIGURED"
    ? createClient(supabaseConfiguration.config.url, supabaseConfiguration.config.publishableKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
        },
      })
    : null;

export function getSupabaseClient(): SupabaseClient | null {
  return supabaseClient;
}
