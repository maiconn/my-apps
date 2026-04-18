import { getSupabaseClient } from './data/supabaseClient.js';
import { requireAuth, signOut } from './auth.js';
import { RegistroTreinoRepository } from './data/registroTreinoRepository.js';
import { SparringRepository } from './data/sparringRepository.js';
import { validarRegistroTreino } from './domain/registroTreino.js';
import { validarSparring } from './domain/sparring.js';
import { mountRegistroTreinoForm } from './ui/registroTreinoForm.js';
import { mountSparringSection } from './ui/sparringSection.js';
import { showLoader, hideLoader, withLoader } from './ui/loader.js';
import { mostrarFeedback, limparFeedback } from './utils/feedback.js';
import { STORAGE_DATA_TREINO } from './utils/storage.js';
import { formatarDataPtLonga, isoLocalDate, normalizarDataIsoDb, parseDataIso } from './utils/date.js';

const feedback = /** @type {HTMLElement} */ (document.getElementById('feedback'));
const authStatus = /** @type {HTMLElement} */ (document.getElementById('auth-status'));
const btnSalvar = /** @type {HTMLButtonElement} */ (document.getElementById('btn-salvar'));
const btnExcluir = /** @type {HTMLButtonElement} */ (document.getElementById('btn-excluir'));
const regRoot = /** @type {HTMLElement} */ (document.getElementById('registro-root'));
const spRoot = /** @type {HTMLElement} */ (document.getElementById('sparring-root'));
const treinoDataLabel = /** @type {HTMLElement} */ (document.getElementById('treino-data-label'));

/**
 * Lê ?data= da URL (searchParams, hash ou href) e, se não houver, usa sessionStorage
 * (definido ao clicar no calendário — fallback se algo alterar a URL antes do main).
 * @returns {string | null}
 */
function lerDataUrlOuStorage() {
  const href = window.location.href;
  let raw = new URL(href).searchParams.get('data');
  if (!raw) {
    const m = /[?&#]data=([^&]+)/.exec(href);
    if (m) {
      try {
        raw = decodeURIComponent(m[1].replace(/\+/g, ' '));
      } catch {
        raw = m[1];
      }
    }
  }
  if (raw != null && String(raw).trim() !== '') {
    sessionStorage.removeItem(STORAGE_DATA_TREINO);
    return String(raw).trim();
  }
  const pending = sessionStorage.getItem(STORAGE_DATA_TREINO);
  if (pending) {
    sessionStorage.removeItem(STORAGE_DATA_TREINO);
    return pending.trim();
  }
  return null;
}

async function main() {
  /** Captura imediata antes de auth/Supabase (evita perder query se a URL for alterada). */
  const paramsEarly = new URLSearchParams(window.location.search);
  const editId = paramsEarly.get('id');
  const dataParamRaw = lerDataUrlOuStorage();

  let client;
  try {
    client = getSupabaseClient();
  } catch (e) {
    mostrarFeedback(feedback, false, String(/** @type {Error} */ (e).message));
    if (btnSalvar) btnSalvar.disabled = true;
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
  const spRepo = new SparringRepository(client);

  /** Data escolhida: ?data=, storage (calendário), ou hoje se abriu index sem data */
  let dataTreinoISO;
  if (dataParamRaw != null && dataParamRaw !== '') {
    const parsed = parseDataIso(dataParamRaw);
    if (!parsed) {
      mostrarFeedback(feedback, false, 'Data inválida na URL. Use o formato AAAA-MM-DD (ex.: 2026-03-27).');
      if (btnSalvar) btnSalvar.disabled = true;
      return;
    }
    dataTreinoISO = parsed;
  } else {
    dataTreinoISO = isoLocalDate();
  }

  let loaded = null;
  /** @type {string | null} */
  let registroIdEdicao = null;

  try {
    if (editId) {
      loaded = await withLoader(() => regRepo.findByIdCompleto(userId, editId));
      if (!loaded) {
        mostrarFeedback(feedback, false, 'Treino não encontrado.');
        if (btnSalvar) btnSalvar.disabled = true;
        return;
      }
      registroIdEdicao = loaded.id;
      dataTreinoISO = normalizarDataIsoDb(loaded.dataTreino);
    } else {
      const existente = await withLoader(() => regRepo.findIdByUserAndData(userId, dataTreinoISO));
      if (existente) {
        loaded = await withLoader(() => regRepo.findByIdCompleto(userId, existente));
        if (!loaded) {
          mostrarFeedback(feedback, false, 'Treino não encontrado.');
          if (btnSalvar) btnSalvar.disabled = true;
          return;
        }
        registroIdEdicao = loaded.id;
        dataTreinoISO = normalizarDataIsoDb(loaded.dataTreino);
        const url = new URL(window.location.href);
        url.searchParams.set('id', existente);
        url.searchParams.delete('data');
        window.history.replaceState({}, '', url.toString());
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    mostrarFeedback(feedback, false, `Erro ao carregar treino: ${msg}`);
    if (btnSalvar) btnSalvar.disabled = true;
    return;
  }

  if (treinoDataLabel) {
    const dataFmt = formatarDataPtLonga(dataTreinoISO);
    treinoDataLabel.textContent = registroIdEdicao
      ? `Editando treino de ${dataFmt}`
      : `Novo treino em ${dataFmt} — preencha e salve.`;
  }

  if (btnExcluir) {
    btnExcluir.hidden = !registroIdEdicao;
  }
  if (btnSalvar) {
    btnSalvar.textContent = registroIdEdicao ? 'Atualizar treino' : 'Salvar treino';
  }

  const regForm = await mountRegistroTreinoForm(client, regRoot, loaded ? { initial: loaded.form } : {});
  const spSection = await mountSparringSection(
    client,
    spRoot,
    loaded ? { userId, initialSparrings: loaded.sparrings } : { userId },
  );

  btnExcluir?.addEventListener('click', async () => {
    if (!registroIdEdicao) return;
    if (!window.confirm('Excluir este treino e todos os sparrings vinculados?')) return;
    limparFeedback(feedback);
    try {
      await withLoader(() => regRepo.deleteById(userId, registroIdEdicao));
      mostrarFeedback(feedback, true, 'Treino excluído.');
      window.location.href = 'index.html';
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      mostrarFeedback(feedback, false, msg);
    }
  });

  btnSalvar?.addEventListener('click', async () => {
    limparFeedback(feedback);
    const {
      data: { session: s },
    } = await client.auth.getSession();
    if (!s?.user) {
      mostrarFeedback(feedback, false, 'É necessário estar autenticado para salvar.');
      return;
    }
    const uid = s.user.id;

    const rawReg = regForm.getData();
    const vReg = validarRegistroTreino(rawReg);
    if (!vReg.ok) {
      mostrarFeedback(feedback, false, vReg.erros.join(' '));
      return;
    }

    const rawSps = spSection.getData();
    /** @type {import('./domain/sparring.js').SparringInput[]} */
    const sparringsOk = [];
    for (let i = 0; i < rawSps.length; i++) {
      const vs = validarSparring(rawSps[i]);
      if (!vs.ok) {
        mostrarFeedback(feedback, false, `Sparring ${i + 1}: ${vs.erros.join(' ')}`);
        return;
      }
      sparringsOk.push(vs.value);
    }

    try {
      if (registroIdEdicao) {
        await withLoader(async () => {
          await regRepo.updateFull(uid, registroIdEdicao, vReg.value);
          await spRepo.replaceForRegistro(registroIdEdicao, sparringsOk, uid);
        });
        mostrarFeedback(feedback, true, 'Treino atualizado com sucesso.');
      } else {
        const { id } = await withLoader(async () => {
          const result = await regRepo.create(uid, vReg.value, dataTreinoISO);
          await spRepo.createMany(result.id, sparringsOk, uid);
          return result;
        });
        mostrarFeedback(feedback, true, 'Treino salvo com sucesso.');
        window.location.replace(`registrar-treino.html?id=${id}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/duplicate|unique|23505/i.test(msg)) {
        mostrarFeedback(feedback, false, 'Já existe treino nesta data. Abra pelo calendário para editar.');
      } else {
        mostrarFeedback(feedback, false, msg);
      }
    }
  });
}

void main().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  mostrarFeedback(feedback, false, msg);
  if (btnSalvar) btnSalvar.disabled = true;
});
