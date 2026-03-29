/**
 * Persistência: ações técnicas (catálogo + find or create).
 */

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @returns {Promise<{ id: string, nome: string }[]>}
 */
export async function listarAcoesTecnicas(client) {
  const { data, error } = await client.from('acao_tecnica').select('id, nome').order('nome');
  if (error) throw error;
  return data ?? [];
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} nome
 * @param {string} userId
 * @returns {Promise<string>}
 */
export async function encontrarOuCriarAcaoTecnica(client, nome, userId) {
  const n = nome.trim();
  const { data: global } = await client
    .from('acao_tecnica')
    .select('id')
    .is('user_id', null)
    .ilike('nome', n)
    .maybeSingle();
  if (global?.id) return global.id;

  const { data: own } = await client
    .from('acao_tecnica')
    .select('id')
    .eq('user_id', userId)
    .ilike('nome', n)
    .maybeSingle();
  if (own?.id) return own.id;

  const { data: inserted, error } = await client
    .from('acao_tecnica')
    .insert({ nome: n, user_id: userId })
    .select('id')
    .single();
  if (error) throw error;
  return inserted.id;
}
