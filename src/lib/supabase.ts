import { createClient } from '@supabase/supabase-js';

const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL     as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const CLOUD_ENABLED = !!(supabaseUrl && supabaseAnonKey);

// Only instantiate when credentials are present — avoids crash on missing env vars
export const supabase = CLOUD_ENABLED
  ? createClient(supabaseUrl!, supabaseAnonKey!)
  : null as never;
