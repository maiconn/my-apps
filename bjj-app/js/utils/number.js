/**
 * Utilitarios numericos para exibicao.
 */

/**
 * @param {number} valor
 * @returns {string}
 */
export function formatarNumeroPtBr(valor) {
  return Number(valor ?? 0).toLocaleString('pt-BR');
}
