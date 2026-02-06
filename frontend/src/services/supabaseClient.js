import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

// Singleton client for the frontend. Never use service role keys in the browser.
let supabase;

// Check if Supabase environment variables are configured
if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes("placeholder")) {
  console.error(
    "❌ Supabase not configured! Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.\n" +
    "   Authentication will not work until these are set.\n\n" +
    "   To find these values:\n" +
    "   1. Go to https://app.supabase.com\n" +
    "   2. Select your project\n" +
    "   3. Click 'Settings' (gear icon) → 'API'\n" +
    "   4. Copy 'Project URL' → VITE_SUPABASE_URL\n" +
    "   5. Copy 'anon' key → VITE_SUPABASE_ANON_KEY\n" +
    "   Create frontend/.env file with these values."
  );
  // Create a client that will fail with clear errors rather than silently using placeholder
  supabase = createClient(
    supabaseUrl || "https://placeholder.supabase.co",
    supabaseAnonKey || "placeholder-key"
  );
} else {
  try {
    // Configure Supabase client with PKCE flow explicitly
    supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        flowType: 'pkce',
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false, // We handle callbacks manually via AuthCallbackPage
      },
    });
  } catch (error) {
    console.error("Supabase client initialization failed:", error);
    // Fallback to placeholder only if createClient itself fails (shouldn't happen)
    supabase = createClient("https://placeholder.supabase.co", "placeholder-key", {
      auth: {
        flowType: 'pkce',
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });
  }
}

export { supabase };


