import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { getSupabasePublishableKey, getSupabaseUrl, hasSupabaseEnv } from "@/lib/supabase-env";

export { hasSupabaseEnv };

export async function createSupabaseServerClient() {
  if (!hasSupabaseEnv()) return null;
  const supabaseUrl = getSupabaseUrl();
  const supabaseKey = getSupabasePublishableKey();
  const cookieStore = await cookies();
  return createServerClient<Database>(
    supabaseUrl!,
    supabaseKey!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options: Parameters<typeof cookieStore.set>[2] }>) {
          cookiesToSet.forEach(({ name, value, options }) => {
            try {
              cookieStore.set(name, value, options);
            } catch {
              // Server Components cannot set cookies; middleware refreshes sessions before rendering.
            }
          });
        }
      }
    }
  );
}

export function createSupabaseAdminClient() {
  const supabaseUrl = getSupabaseUrl();
  if (!supabaseUrl || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }

  return createClient<Database>(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}
