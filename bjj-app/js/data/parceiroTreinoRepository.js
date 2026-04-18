/**
 * Persistencia: parceiros de treino (autocomplete + find or create).
 */

import { mapearParceiroTreino } from './utils/parceiroTreino.js';

/**
 * @typedef {'M' | 'F'} ParceiroTreinoSexo
 * @typedef {'branca' | 'azul' | 'roxa' | 'marrom' | 'preta'} ParceiroTreinoFaixa
 *
 * @typedef {{
 *   id: string,
 *   nome: string,
 *   sexo: ParceiroTreinoSexo,
 *   aniversario: string,
 *   faixa: ParceiroTreinoFaixa,
 *   pesoKg: number,
 * }} ParceiroTreino
 */

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} userId
 * @param {string} termo
 * @param {number} [limite]
 * @returns {Promise<ParceiroTreino[]>}
 */
export async function buscarParceirosTreinoPorPrefixo(client, userId, termo, limite = 8) {
  const q = String(termo ?? '').trim();
  if (q.length < 2) return [];

  const { data, error } = await client
    .from('parceiro_treino')
    .select('id, nome, sexo, aniversario, faixa, peso_kg')
    .eq('user_id', userId)
    .ilike('nome', `${q}%`)
    .order('nome', { ascending: true })
    .limit(limite);

  if (error) throw error;

  return (data ?? []).map((row) => mapearParceiroTreino(/** @type {Record<string, unknown>} */ (row)));
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {{ nome: string, sexo: ParceiroTreinoSexo, aniversario: string, faixa: ParceiroTreinoFaixa, pesoKg: number }} parceiro
 * @param {string} userId
 * @returns {Promise<string>}
 */
export async function encontrarOuCriarParceiroTreino(client, parceiro, userId) {
  const nome = parceiro.nome.trim();

  const { data: existente, error: eFind } = await client
    .from('parceiro_treino')
    .select('id')
    .eq('user_id', userId)
    .ilike('nome', nome)
    .maybeSingle();
  if (eFind) throw eFind;

  const payload = {
    sexo: parceiro.sexo,
    aniversario: parceiro.aniversario,
    faixa: parceiro.faixa,
    peso_kg: parceiro.pesoKg,
  };

  if (existente?.id) {
    const { error: eUp } = await client.from('parceiro_treino').update(payload).eq('id', existente.id).eq('user_id', userId);
    if (eUp) throw eUp;
    return String(existente.id);
  }

  const { data: inserted, error: eIns } = await client
    .from('parceiro_treino')
    .insert({
      user_id: userId,
      nome,
      ...payload,
    })
    .select('id')
    .single();
  if (eIns) throw eIns;

  return String(inserted.id);
}
