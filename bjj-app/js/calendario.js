import { getSupabaseClient } from './data/supabaseClient.js';
import { requireAuth, signOut } from './auth.js';
import { RegistroTreinoRepository } from './data/registroTreinoRepository.js';

const monthNames = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

const weekLabels = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

/** Mesma chave que em main.js — fallback se a URL perder ?data= */
const STORAGE_DATA_TREINO = 'bjj-treino-data-iso';

/**
 * @param {number} n
 */
function pad2(n) {
  return String(n).padStart(2, '0');
}

/**
 * @param {HTMLElement | null} el
 * @param {string} msg
 */
function showErr(el, msg) {
  if (!el) return;
  el.textContent = msg;
  el.className = 'feedback visible err';
}

async function main() {
  sessionStorage.removeItem(STORAGE_DATA_TREINO);

  const feedbackCal = /** @type {HTMLElement} */ (document.getElementById('feedback-cal'));
  const authStatus = /** @type {HTMLElement} */ (document.getElementById('auth-status'));



  let client;
  try {
    client = getSupabaseClient();
  } catch (e) {
    showErr(feedbackCal, String(/** @type {Error} */ (e).message));
    return;
  }

  const session = await requireAuth(client);
  if (!session) return;

  if (authStatus) {
    authStatus.textContent = session.user.email ?? 'Sessão ativa';
  }

  document.getElementById('btn-logout')?.addEventListener('click', () => signOut(client));

  const userId = session.user.id;
  const regRepo = new RegistroTreinoRepository(client);

  const titleEl = /** @type {HTMLElement} */ (document.getElementById('cal-title'));
  const gridEl = /** @type {HTMLElement} */ (document.getElementById('cal-grid'));
  const weekdaysEl = /** @type {HTMLElement} */ (document.getElementById('cal-weekdays'));

  if (weekdaysEl) {
    weekdaysEl.innerHTML = weekLabels.map((w) => `<span>${w}</span>`).join('');
  }

  let year = new Date().getFullYear();
  let month = new Date().getMonth() + 1;

  async function render() {
    if (titleEl) {
      titleEl.textContent = `${monthNames[month - 1]} ${year}`;
    }
    if (feedbackCal) {
      feedbackCal.className = 'feedback';
      feedbackCal.textContent = '';
    }

    let rows;
    try {
      rows = await regRepo.listByMonth(userId, year, month);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showErr(feedbackCal, msg);
      return;
    }

    const byDate = new Map(
      rows.map((r) => {
        const raw = r.data_treino;
        const key = typeof raw === 'string' ? raw.slice(0, 10) : String(raw).slice(0, 10);
        return [key, r.id];
      }),
    );

    if (!gridEl) return;
    gridEl.innerHTML = '';

    const first = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0).getDate();
    const startWeekday = (first.getDay() + 6) % 7;

    for (let i = 0; i < startWeekday; i++) {
      const cell = document.createElement('div');
      cell.className = 'cal-cell cal-cell--empty';
      gridEl.appendChild(cell);
    }

    for (let d = 1; d <= lastDay; d++) {
      const iso = `${year}-${pad2(month)}-${pad2(d)}`;
      const id = byDate.get(iso);
      const cell = document.createElement('div');
      cell.className = 'cal-cell';
      const btn = document.createElement('a');
      btn.href = new URL(`registrar-treino.html?data=${encodeURIComponent(iso)}`, window.location.href).href;
      btn.className = `cal-day cal-day--${id ? 'ok' : 'miss'}`;
      btn.textContent = String(d);
      btn.setAttribute(
        'aria-label',
        id ? `Treino em ${iso}, abrir para editar` : `Sem treino em ${iso}, cadastrar novo`,
      );
      btn.addEventListener('click', () => {
        sessionStorage.setItem(STORAGE_DATA_TREINO, iso);
      });
      cell.appendChild(btn);
      gridEl.appendChild(cell);
    }
  }

  document.getElementById('cal-prev')?.addEventListener('click', () => {
    month -= 1;
    if (month < 1) {
      month = 12;
      year -= 1;
    }
    void render();
  });

  document.getElementById('cal-next')?.addEventListener('click', () => {
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
    void render();
  });

  await render();
}

void main();
