/**
 * Utilitarios de dominio para parceiro de treino.
 */

/**
 * @param {unknown} faixa
 * @returns {string}
 */
export function normalizarFaixaParceiro(faixa) {
  return String(faixa ?? '').toLowerCase().trim();
}
