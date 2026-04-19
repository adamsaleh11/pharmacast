export type PublicEnv = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  apiUrl: string;
  hasSupabaseConfig: boolean;
  hasApiConfig: boolean;
};

export function getPublicEnv(): PublicEnv {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "";

  return {
    supabaseUrl,
    supabaseAnonKey,
    apiUrl,
    hasSupabaseConfig: Boolean(supabaseUrl && supabaseAnonKey),
    hasApiConfig: Boolean(apiUrl)
  };
}
