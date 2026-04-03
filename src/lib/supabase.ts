import { createClient } from '@supabase/supabase-js';

// REPLACE THESE WITH YOUR ACTUAL KEYS FROM SUPABASE DASHBOARD
const supabaseUrl = 'https://zcxysvrwblwogubakssf.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpjeHlzdnJ3Ymx3b2d1YmFrc3NmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzMDc4MjQsImV4cCI6MjA4OTg4MzgyNH0.VVML6ANrmYomW1c88wYmCBJR-uX3DcpSffBx1AqzyUE';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);