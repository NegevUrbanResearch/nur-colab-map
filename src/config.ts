const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const stadiaApiKey = import.meta.env.VITE_STADIA_API_KEY;

if (!supabaseAnonKey || !supabaseUrl || !stadiaApiKey) {
  throw new Error("Missing required application configuration.");
}

export const SUPABASE_ANON_KEY = supabaseAnonKey;
export const SUPABASE_URL = supabaseUrl;
export const STADIA_API_KEY = stadiaApiKey;
