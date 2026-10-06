export const config = {
  demo: process.env.EXPO_PUBLIC_DEMO_MODE !== "false",
  apiUrl: process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001",
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? "",
  supabaseKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "",
};
