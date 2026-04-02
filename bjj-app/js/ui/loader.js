/**
 * Utilitário: controle de loader/spinner durante operações assíncronas
 */

/**
 * Mostra o loader na tela
 */
export function showLoader() {
  const loadEl = document.getElementById('app-loader');
  if (loadEl) {
    loadEl.hidden = false;
    loadEl.setAttribute('aria-hidden', 'false');
  }
}

/**
 * Esconde o loader da tela
 */
export function hideLoader() {
  const loadEl = document.getElementById('app-loader');
  if (loadEl) {
    loadEl.hidden = true;
    loadEl.setAttribute('aria-hidden', 'true');
  }
}

/**
 * Executa uma função assíncrona com loader automático
 * @template T
 * @param {() => Promise<T>} fn
 * @returns {Promise<T>}
 */
export async function withLoader(fn) {
  showLoader();
  try {
    return await fn();
  } finally {
    hideLoader();
  }
}
