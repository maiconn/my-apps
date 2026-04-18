/**
 * Utilitarios de normalizacao de texto para UI.
 */

/**
 * @param {string} s
 * @returns {string}
 */
export function normalizarTexto(s) {
  return String(s ?? '').trim().toLowerCase();
}

/**
 * @param {string} s
 * @returns {string}
 */
export function capitalizarPrimeira(s) {
  const texto = String(s ?? '').trim();
  return texto ? `${texto[0].toUpperCase()}${texto.slice(1).toLowerCase()}` : '';
}
