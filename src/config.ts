const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

if (!supabaseAnonKey || !supabaseUrl) {
  throw new Error("Missing required application configuration.");
}

export const SUPABASE_ANON_KEY = supabaseAnonKey;
export const SUPABASE_URL = supabaseUrl;
