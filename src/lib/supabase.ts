import { createClient } from '@supabase/supabase-js';

// Use Environment Variables first. If not found (local dev), use empty string (will fail safely).
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing Supabase URL or Key! Check your .env file or Vercel Environment Variables.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);