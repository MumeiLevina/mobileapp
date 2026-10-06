import { createClient } from "@supabase/supabase-js";
import { privateStorage } from "../lib/storage";
import { config } from "../lib/config";
export const supabase =
  config.supabaseUrl && config.supabaseKey
    ? createClient(config.supabaseUrl, config.supabaseKey, {
        auth: {
          storage: privateStorage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        },
      })
    : null;
