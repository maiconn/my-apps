import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.1/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config.js';

/** @returns {ReturnType<typeof createClient>} */
export function getSupabaseClient() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || SUPABASE_URL.includes('SEU_PROJETO')) {
    throw new Error('Configure SUPABASE_URL e SUPABASE_ANON_KEY em js/config.js (veja config.example.js).');
  }
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      // Evita replaceState na URL que pode apagar ?data= ao iniciar a sessão
      detectSessionInUrl: false,
    },
  });
}
