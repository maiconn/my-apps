/**
 * Persistência: tipos de treino e variações (autocomplete + find or create).
 */

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @returns {Promise<{ id: string, nome: string }[]>}
 */
export async function listarTiposTreino(client) {
  const { data, error } = await client.from('tipo_treino').select('id, nome').order('nome');
  if (error) throw error;
  return data ?? [];
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} tipoTreinoId
 * @returns {Promise<{ id: string, nome: string }[]>}
 */
export async function listarVariacoesPorTipo(client, tipoTreinoId) {
  const { data, error } = await client
    .from('variacao')
    .select('id, nome')
    .eq('tipo_treino_id', tipoTreinoId)
    .order('nome');
  if (error) throw error;
  return data ?? [];
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} nome
 * @param {string} userId
 * @returns {Promise<string>}
 */
export async function encontrarOuCriarTipoTreino(client, nome, userId) {
  const n = nome.trim();
  const { data: global } = await client
    .from('tipo_treino')
    .select('id')
    .is('user_id', null)
    .ilike('nome', n)
    .maybeSingle();
  if (global?.id) return global.id;

  const { data: own } = await client
    .from('tipo_treino')
    .select('id')
    .eq('user_id', userId)
    .ilike('nome', n)
    .maybeSingle();
  if (own?.id) return own.id;

  const { data: inserted, error } = await client
    .from('tipo_treino')
    .insert({ nome: n, user_id: userId })
    .select('id')
    .single();
  if (error) throw error;
  return inserted.id;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} tipoTreinoId
 * @param {string} nome
 * @param {string} userId
 * @returns {Promise<string>}
 */
export async function encontrarOuCriarVariacao(client, tipoTreinoId, nome, userId) {
  const n = nome.trim();
  const { data: global } = await client
    .from('variacao')
    .select('id')
    .eq('tipo_treino_id', tipoTreinoId)
    .is('user_id', null)
    .ilike('nome', n)
    .maybeSingle();
  if (global?.id) return global.id;

  const { data: own } = await client
    .from('variacao')
    .select('id')
    .eq('tipo_treino_id', tipoTreinoId)
    .eq('user_id', userId)
    .ilike('nome', n)
    .maybeSingle();
  if (own?.id) return own.id;

  const { data: inserted, error } = await client
    .from('variacao')
    .insert({ tipo_treino_id: tipoTreinoId, nome: n, user_id: userId })
    .select('id')
    .single();
  if (error) throw error;
  return inserted.id;
}
