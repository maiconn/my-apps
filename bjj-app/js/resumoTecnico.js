import { getSupabaseClient } from './data/supabaseClient.js';
import { requireAuth, signOut } from './auth.js';
import { withLoader } from './ui/loader.js';
import { mostrarFeedback, limparFeedback } from './utils/feedback.js';
import { formatarNumeroPtBr } from './utils/number.js';
import { escapeHtml } from './ui/utils/escape.js';
import { formatarDataPtCurta, isoLocalDate } from './utils/date.js';
import { ResumoTecnicoRepository } from './data/resumoTecnicoRepository.js';

const feedback = /** @type {HTMLElement} */ (document.getElementById('feedback-resumo-tecnico'));
const authStatus = /** @type {HTMLElement} */ (document.getElementById('auth-status'));
const periodoTipo = /** @type {HTMLSelectElement} */ (document.getElementById('periodo-tipo'));
const periodoCustomFields = /** @type {HTMLElement} */ (document.getElementById('periodo-custom-fields'));
const periodoInicio = /** @type {HTMLInputElement} */ (document.getElementById('periodo-inicio'));
const periodoFim = /** @type {HTMLInputElement} */ (document.getElementById('periodo-fim'));
const btnAplicarPeriodo = /** @type {HTMLButtonElement} */ (document.getElementById('btn-aplicar-periodo'));
const resumoPeriodoLegenda = /** @type {HTMLElement} */ (document.getElementById('resumo-periodo-legenda'));
const resumoAcoesBody = /** @type {HTMLElement} */ (document.getElementById('resumo-acoes-body'));
const resumoAcaoTitulo = /** @type {HTMLElement} */ (document.getElementById('resumo-acao-titulo'));
const resumoParceirosBody = /** @type {HTMLElement} */ (document.getElementById('resumo-parceiros-body'));

/** @type {import('./data/resumoTecnicoRepository.js').AcaoTecnicaResumo[]} */
let acoesAtuais = [];
/** @type {string | null} */
let acaoAtivaId = null;

/**
 * @returns {string}
 */
function dataHojeIso() {
  return isoLocalDate(new Date());
}

/**
 * @returns {string}
 */
function dataIsoComDiasAtras(dias) {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return isoLocalDate(d);
}

function atualizarVisibilidadePeriodoCustom() {
  const ehCustom = periodoTipo.value === 'custom';
  periodoCustomFields.hidden = !ehCustom;
  periodoInicio.disabled = !ehCustom;
  periodoFim.disabled = !ehCustom;
}

function preencherDatasCustomPadrao() {
  periodoFim.value = dataHojeIso();
  periodoInicio.value = dataIsoComDiasAtras(6);
}

/**
 * @returns {import('./data/resumoTecnicoRepository.js').FiltroResumoTecnico}
 */
function construirFiltroAtual() {
  const tipo = /** @type {import('./data/resumoTecnicoRepository.js').TipoPeriodoResumo} */ (periodoTipo.value);

  if (tipo === 'custom') {
    return {
      tipo,
      dataInicio: periodoInicio.value || null,
      dataFim: periodoFim.value || null,
    };
  }

  return { tipo };
}

/**
 * @param {import('./data/resumoTecnicoRepository.js').ResumoTecnicoResultado} resultado
 */
function renderLegendaPeriodo(resultado) {
  if (resultado.tipo === 'todos') {
    resumoPeriodoLegenda.textContent = 'Exibindo todos os registros disponiveis.';
    return;
  }

  if (!resultado.dataInicio || !resultado.dataFim) {
    resumoPeriodoLegenda.textContent = 'Periodo nao identificado.';
    return;
  }

  resumoPeriodoLegenda.textContent = `Periodo aplicado: ${formatarDataPtCurta(resultado.dataInicio)} ate ${formatarDataPtCurta(
    resultado.dataFim,
  )}.`;
}

/**
 * @param {import('./data/resumoTecnicoRepository.js').AcaoTecnicaResumo} acao
 */
function renderDetalhesAcao(acao) {
  acaoAtivaId = acao.acaoTecnicaId;
  resumoAcaoTitulo.textContent = `Parceiros consolidados para: ${acao.acaoTecnicaNome}`;

  if (acao.parceiros.length === 0) {
    resumoParceirosBody.innerHTML = '<tr><td colspan="5" class="text-muted">Nenhum parceiro encontrado para esta acao no periodo.</td></tr>';
    return;
  }

  resumoParceirosBody.innerHTML = acao.parceiros
    .map(
      (p) => `
      <tr>
        <td>${escapeHtml(p.parceiroNome)}</td>
        <td class="num">${formatarNumeroPtBr(p.totalAcoes)}</td>
        <td class="num">${formatarNumeroPtBr(p.falhaTotal)}</td>
        <td class="num">${formatarNumeroPtBr(p.parcialTotal)}</td>
        <td class="num">${formatarNumeroPtBr(p.sucessoTotal)}</td>
      </tr>
    `,
    )
    .join('');
}

function renderAcoes() {
  if (acoesAtuais.length === 0) {
    resumoAcoesBody.innerHTML = '<tr><td colspan="5" class="text-muted">Nenhuma acao tecnica encontrada no periodo.</td></tr>';
    resumoAcaoTitulo.textContent = 'Selecione uma acao tecnica para ver os parceiros consolidados.';
    resumoParceirosBody.innerHTML = '<tr><td colspan="5" class="text-muted">Nenhuma acao selecionada.</td></tr>';
    acaoAtivaId = null;
    return;
  }

  resumoAcoesBody.innerHTML = acoesAtuais
    .map(
      (acao) => `
      <tr class="acao-resumo-row ${acaoAtivaId === acao.acaoTecnicaId ? 'is-active' : ''}" data-acao-id="${escapeHtml(acao.acaoTecnicaId)}">
        <td>
          <button type="button" class="btn-link acao-select-btn" data-acao-id="${escapeHtml(acao.acaoTecnicaId)}">
            ${escapeHtml(acao.acaoTecnicaNome)}
          </button>
        </td>
        <td class="num">${formatarNumeroPtBr(acao.totalAcoes)}</td>
        <td class="num">${formatarNumeroPtBr(acao.falhaTotal)}</td>
        <td class="num">${formatarNumeroPtBr(acao.parcialTotal)}</td>
        <td class="num">${formatarNumeroPtBr(acao.sucessoTotal)}</td>
      </tr>
    `,
    )
    .join('');
}

/**
 * @param {string} acaoId
 */
function selecionarAcaoPorId(acaoId) {
  const acao = acoesAtuais.find((item) => item.acaoTecnicaId === acaoId);
  if (!acao) return;

  renderDetalhesAcao(acao);
  renderAcoes();
}

/**
 * @param {string} userId
 * @param {ResumoTecnicoRepository} repo
 */
async function carregarResumo(userId, repo) {
  limparFeedback(feedback);

  const filtro = construirFiltroAtual();
  const resultado = await withLoader(() => repo.carregarResumo(userId, filtro));

  acoesAtuais = resultado.acoes;
  renderLegendaPeriodo(resultado);

  if (acoesAtuais.length === 0) {
    acaoAtivaId = null;
    renderAcoes();
    return;
  }

  const acaoInicial = acoesAtuais.find((a) => a.acaoTecnicaId === acaoAtivaId) ?? acoesAtuais[0];
  renderDetalhesAcao(acaoInicial);
  renderAcoes();
}

async function main() {
  let client;
  try {
    client = getSupabaseClient();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    mostrarFeedback(feedback, false, msg);
    return;
  }

  const session = await requireAuth(client);
  if (!session) return;

  if (authStatus) {
    authStatus.textContent = session.user.email ?? 'Sessao ativa';
  }

  document.getElementById('btn-logout')?.addEventListener('click', () => signOut(client));

  preencherDatasCustomPadrao();
  atualizarVisibilidadePeriodoCustom();

  const repo = new ResumoTecnicoRepository(client);
  const userId = session.user.id;

  periodoTipo.addEventListener('change', () => {
    atualizarVisibilidadePeriodoCustom();
  });

  btnAplicarPeriodo.addEventListener('click', async () => {
    try {
      await carregarResumo(userId, repo);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      mostrarFeedback(feedback, false, `Erro ao carregar resumo tecnico: ${msg}`);
    }
  });

  resumoAcoesBody.addEventListener('click', (event) => {
    const target = /** @type {HTMLElement | null} */ (event.target instanceof HTMLElement ? event.target : null);
    const btn = target?.closest('[data-acao-id]');
    if (!btn) return;
    const acaoId = btn.getAttribute('data-acao-id');
    if (!acaoId) return;
    selecionarAcaoPorId(acaoId);
  });

  try {
    await carregarResumo(userId, repo);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    mostrarFeedback(feedback, false, `Erro ao carregar resumo tecnico: ${msg}`);
  }
}

void main();
