import { getSupabaseClient } from './data/supabaseClient.js';
import { requireAuth, signOut } from './auth.js';
import { SparringParceiroRepository } from './data/sparringParceiroRepository.js';
import { withLoader } from './ui/loader.js';
import { mostrarFeedback, limparFeedback } from './utils/feedback.js';
import { formatarNumeroPtBr } from './utils/number.js';
import { escapeHtml } from './ui/utils/escape.js';
import { calcularIdade, formatarPesoKg } from './ui/utils/format.js';
import { capitalizarPrimeira } from './ui/utils/string.js';

const feedback = /** @type {HTMLElement} */ (document.getElementById('feedback-sparring-parceiro'));
const authStatus = /** @type {HTMLElement} */ (document.getElementById('auth-status'));
const parceirosLista = /** @type {HTMLElement} */ (document.getElementById('parceiros-lista'));
const parceiroDetalhes = /** @type {HTMLElement} */ (document.getElementById('parceiro-detalhes'));

/** @type {string | null} */
let parceiroAtivoId = null;


/**
 * @param {HTMLElement} btn
 */
function marcarParceiroAtivo(btn) {
  const itens = document.querySelectorAll('.partner-item');
  itens.forEach((el) => el.classList.remove('is-active'));
  btn.classList.add('is-active');
}

/**
 * @param {HTMLElement} root
 * @param {import('./data/sparringParceiroRepository.js').ResumoSparringPorParceiro} resumo
 */
function renderDetalhes(root, resumo) {
  const { parceiro, totalSparrings, acoesConsolidadas } = resumo;
  const idadeParceiro = calcularIdade(parceiro.aniversario);

  const linhasAcoes =
    acoesConsolidadas.length > 0
      ? acoesConsolidadas
          .map(
            (acao) => `
        <tr>
          <td>${escapeHtml(acao.acaoTecnicaNome)}</td>
          <td class="num">${formatarNumeroPtBr(acao.cadastros)}</td>
          <td class="num">${formatarNumeroPtBr(acao.falhaTotal)}</td>
          <td class="num">${formatarNumeroPtBr(acao.parcialTotal)}</td>
          <td class="num">${formatarNumeroPtBr(acao.sucessoTotal)}</td>
          <td class="num">${formatarNumeroPtBr(acao.total)}</td>
        </tr>
      `,
          )
          .join('')
      : '<tr><td colspan="6" class="text-muted">Nenhuma ação técnica registrada para este parceiro.</td></tr>';

  root.innerHTML = `
    <h3>${escapeHtml(parceiro.nome)}</h3>
    <div class="partner-data">
      <div><strong>Total de sparrings:</strong> ${escapeHtml(formatarNumeroPtBr(totalSparrings))}</div>
      <div><strong>Sexo:</strong> ${escapeHtml(parceiro.sexo)}</div>
      <div><strong>Faixa:</strong> ${escapeHtml(capitalizarPrimeira(parceiro.faixa))}</div>
      <div><strong>Peso:</strong> ${escapeHtml(formatarPesoKg(parceiro.pesoKg))}</div>
      <div><strong>Idade:</strong> ${escapeHtml(Number.isFinite(idadeParceiro) ? `${idadeParceiro} anos` : '-')}</div>
    </div>

    <h3>Ações técnicas consolidadas</h3>
    <table class="acoes-table">
      <thead>
        <tr>
          <th>Ação</th>
          <th class="num">Cadastros</th>
          <th class="num">Falha</th>
          <th class="num">Parcial</th>
          <th class="num">Sucesso</th>
          <th class="num">Total</th>
        </tr>
      </thead>
      <tbody>
        ${linhasAcoes}
      </tbody>
    </table>
  `;
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
    authStatus.textContent = session.user.email ?? 'Sessão ativa';
  }

  document.getElementById('btn-logout')?.addEventListener('click', () => signOut(client));

  const userId = session.user.id;
  const repo = new SparringParceiroRepository(client);

  try {
    limparFeedback(feedback);
    const parceiros = await withLoader(() => repo.listarParceirosDoUsuario(userId));

    if (parceiros.length === 0) {
      parceirosLista.innerHTML = '<p class="text-muted">Nenhum parceiro cadastrado ainda.</p>';
      parceiroDetalhes.innerHTML = '<p class="text-muted mt-0">Cadastre sparrings com parceiro para visualizar o resumo.</p>';
      return;
    }

    parceirosLista.innerHTML = '';
    for (const parceiro of parceiros) {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'btn partner-item';
      item.innerHTML = `
        <span class="partner-item-name">${escapeHtml(parceiro.nome)}</span>
        <span class="partner-item-meta">${escapeHtml(capitalizarPrimeira(parceiro.faixa))} - ${escapeHtml(
          formatarPesoKg(parceiro.pesoKg),
        )}</span>
      `;

      item.addEventListener('click', async () => {
        try {
          limparFeedback(feedback);
          parceiroAtivoId = parceiro.id;
          marcarParceiroAtivo(item);
          parceiroDetalhes.innerHTML = '<p class="text-muted mt-0">Carregando resumo...</p>';

          const resumo = await withLoader(() => repo.carregarResumoPorParceiro(userId, parceiro.id));
          if (parceiroAtivoId !== parceiro.id) return;
          renderDetalhes(parceiroDetalhes, resumo);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          mostrarFeedback(feedback, false, `Erro ao carregar resumo do parceiro: ${msg}`);
          parceiroDetalhes.innerHTML = '<p class="text-muted mt-0">Não foi possível carregar o resumo.</p>';
        }
      });

      parceirosLista.appendChild(item);
    }

    parceirosLista.querySelector('.partner-item')?.dispatchEvent(new Event('click'));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    mostrarFeedback(feedback, false, `Erro ao carregar parceiros: ${msg}`);
    parceirosLista.innerHTML = '<p class="text-muted">Erro ao carregar parceiros.</p>';
  }
}

void main();
