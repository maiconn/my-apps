/**
 * Utilitarios de formatacao para UI.
 */

/**
 * @param {number} peso
 * @returns {string}
 */
export function formatarPesoKg(peso) {
  const v = Number(peso);
  if (!Number.isFinite(v)) return '';
  if (Number.isInteger(v)) return `${v}kg`;
  return `${v.toFixed(1)}kg`;
}

/**
 * @param {string} iso
 * @returns {number}
 */
export function calcularIdade(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso ?? ''))) return NaN;
  const [y, m, d] = iso.split('-').map(Number);
  const nasc = new Date(y, m - 1, d);
  if (nasc.getFullYear() !== y || nasc.getMonth() !== m - 1 || nasc.getDate() !== d) return NaN;

  const hoje = new Date();
  let idade = hoje.getFullYear() - y;
  const aindaNaoFez =
    hoje.getMonth() < nasc.getMonth() ||
    (hoje.getMonth() === nasc.getMonth() && hoje.getDate() < nasc.getDate());
  if (aindaNaoFez) idade -= 1;
  return idade < 0 ? NaN : idade;
}
