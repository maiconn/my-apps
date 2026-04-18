/**
 * Utilitarios de string para camada de dominio.
 */

/**
 * @param {unknown} valor
 * @returns {string | null}
 */
export function trimToNull(valor) {
  if (valor == null) return null;
  const s = String(valor).trim();
  return s === '' ? null : s;
}
