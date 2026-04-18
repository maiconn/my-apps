/**
 * Utilitarios de datas em formato ISO e exibicao pt-BR.
 */

/**
 * @param {Date} [d]
 * @returns {string}
 */
export function isoLocalDate(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * @param {unknown} valor
 * @returns {string}
 */
export function normalizarDataIsoDb(valor) {
  if (valor == null) return '';
  const s = String(valor);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return s;
}

/**
 * @param {string | null | undefined} s
 * @returns {string | null}
 */
export function parseDataIso(s) {
  if (s == null || String(s).trim() === '') return null;
  let t = String(s).trim();
  try {
    t = decodeURIComponent(t);
  } catch {
    /* ignore */
  }
  t = t.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  const [y, m, d] = t.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  return t;
}

/**
 * @param {string} iso
 * @returns {string}
 */
export function formatarDataPtLonga(iso) {
  const p = iso.split('-').map(Number);
  if (p.length !== 3 || p.some((n) => Number.isNaN(n))) return iso;
  const [y, mo, da] = p;
  return new Date(y, mo - 1, da).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * @param {string} iso
 * @returns {string}
 */
export function formatarDataPtCurta(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso ?? ''))) return '-';
  const [y, m, d] = String(iso).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR');
}

/**
 * @param {string} iso
 * @returns {string}
 */
export function formatarDataHoraPt(iso) {
  const d = new Date(String(iso ?? ''));
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('pt-BR');
}
