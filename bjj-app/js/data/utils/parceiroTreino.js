/**
 * Utilitarios de mapeamento para parceiro_treino.
 */

/**
 * @typedef {'M' | 'F'} ParceiroTreinoSexo
 * @typedef {'branca' | 'azul' | 'roxa' | 'marrom' | 'preta'} ParceiroTreinoFaixa
 */

/**
 * @param {unknown} faixa
 * @returns {ParceiroTreinoFaixa}
 */
export function normalizarFaixaParceiro(faixa) {
  const s = String(faixa ?? '').toLowerCase();
  if (s === 'azul' || s === 'roxa' || s === 'marrom' || s === 'preta') return s;
  return 'branca';
}

/**
 * @param {Record<string, unknown>} row
 */
export function mapearParceiroTreino(row) {
  return {
    id: String(row.id),
    nome: String(row.nome ?? ''),
    sexo: row.sexo === 'F' ? 'F' : 'M',
    aniversario: String(row.aniversario ?? ''),
    faixa: normalizarFaixaParceiro(row.faixa),
    pesoKg: Number(row.peso_kg ?? 0),
  };
}

/**
 * @param {Record<string, unknown>} row
 */
export function mapearParceiroTreinoComCreatedAt(row) {
  return {
    ...mapearParceiroTreino(row),
    createdAt: String(row.created_at ?? ''),
  };
}
