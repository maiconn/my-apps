/**
 * Utilitarios de feedback visual em componentes com classe .feedback.
 */

/**
 * @param {HTMLElement | null | undefined} el
 * @param {boolean} ok
 * @param {string} text
 */
export function mostrarFeedback(el, ok, text) {
  if (!el) return;
  el.textContent = text;
  el.className = `feedback visible ${ok ? 'ok' : 'err'}`;
}

/**
 * @param {HTMLElement | null | undefined} el
 */
export function limparFeedback(el) {
  if (!el) return;
  el.className = 'feedback';
  el.textContent = '';
}

/**
 * @param {HTMLElement | null | undefined} el
 * @param {string} text
 */
export function mostrarErroFeedback(el, text) {
  mostrarFeedback(el, false, text);
}
