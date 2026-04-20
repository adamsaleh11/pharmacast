export type PublicEnv = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  apiUrl: string;
  missingKeys: string[];
  hasSupabaseConfig: boolean;
  hasApiConfig: boolean;
};

export function getPublicEnv(): PublicEnv {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "";
  const missingKeys = [
    ["NEXT_PUBLIC_SUPABASE_URL", supabaseUrl],
    ["NEXT_PUBLIC_SUPABASE_ANON_KEY", supabaseAnonKey],
    ["NEXT_PUBLIC_API_URL", apiUrl]
  ]
    .filter(([, value]) => !value)
    .map(([key]) => key);

  return {
    supabaseUrl,
    supabaseAnonKey,
    apiUrl,
    missingKeys,
    hasSupabaseConfig: Boolean(supabaseUrl && supabaseAnonKey),
    hasApiConfig: Boolean(apiUrl)
  };
}
