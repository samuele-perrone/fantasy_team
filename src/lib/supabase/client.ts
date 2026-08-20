import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser client. Uses the publishable key, which is safe to ship to the browser — row level
 * security on `profiles` and `squads` is what actually protects the data.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
