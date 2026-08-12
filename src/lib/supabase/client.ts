import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabasePublicConfig } from "@/lib/supabase/config";
import type { Database } from "@/lib/supabase/database.types";

type BudgetBookSupabaseClient = SupabaseClient<
  Database,
  "public",
  "public"
>;

let browserClient: BudgetBookSupabaseClient | null = null;

export function getSupabaseBrowserClient() {
  if (!browserClient) {
    const config = getSupabasePublicConfig();

    browserClient = createClient<Database, "public">(
      config.url,
      config.anonKey,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      },
    );
  }

  return browserClient;
}
