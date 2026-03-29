import { getSupabaseClient } from './data/supabaseClient.js';

/**
 * Garante sessão autenticada. Redireciona para login.html se não houver.
 * @param {ReturnType<typeof getSupabaseClient>} client
 * @returns {Promise<import('@supabase/supabase-js').Session | null>}
 */
export async function requireAuth(client) {
  const {
    data: { session },
  } = await client.auth.getSession();
  if (!session) {
    window.location.replace('login.html');
    return null;
  }
  return session;
}

/**
 * @param {ReturnType<typeof getSupabaseClient>} client
 */
export async function signOut(client) {
  await client.auth.signOut();
  window.location.replace('login.html');
}
