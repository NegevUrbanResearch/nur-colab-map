const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const missingEnvVars: string[] = [];
if (!supabaseAnonKey) missingEnvVars.push("VITE_SUPABASE_ANON_KEY");
if (!supabaseUrl) missingEnvVars.push("VITE_SUPABASE_URL");

if (missingEnvVars.length > 0) {
  throw new Error(
    `Missing required application configuration: ${missingEnvVars.join(
      ", "
    )}. Copy .env.example to .env, fill the missing values, and restart the dev server.`
  );
}

export const SUPABASE_ANON_KEY = supabaseAnonKey;
export const SUPABASE_URL = supabaseUrl;
