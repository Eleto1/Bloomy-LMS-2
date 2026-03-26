import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://zcxysvrwblwogubakssf.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpjeHlzdnJ3Ymx3b2d1YmFrc3NmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzMDc4MjQsImV4cCI6MjA4OTg4MzgyNH0.VVML6ANrmYomW1c88wYmCBJR-uX3DcpSffBx1AqzyUE';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/** Memory-backed storage so ephemeral clients do not share the main auth storage key. */
function createEphemeralAuthStorage() {
  const store: Record<string, string> = {};
  return {
    getItem: (key: string) => (key in store ? store[key] : null),
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
  };
}

/**
 * Sign-up + profile writes for a *different* user without touching the main browser session.
 * Uses a unique storageKey + in-memory storage to avoid "Multiple GoTrueClient" / storage clashes.
 */
export function createEphemeralSupabaseClient(): SupabaseClient {
  const storageKey = `sb-ephemeral-${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: createEphemeralAuthStorage(),
      storageKey,
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
