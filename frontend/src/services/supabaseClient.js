import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Singleton client for the frontend. Never use service role keys in the browser.
export const supabase = createClient(supabaseUrl || "", supabaseAnonKey || "");


