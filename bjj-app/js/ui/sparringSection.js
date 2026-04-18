import { listarAcoesTecnicas } from '../data/acaoTecnicaRepository.js';
import { buscarParceirosTreinoPorPrefixo } from '../data/parceiroTreinoRepository.js';
import { SPARRING_DURACAO_PADRAO, SPARRING_INICIO, sparringPadrao } from '../domain/sparring.js';
import { showLoader, hideLoader } from './loader.js';
import { escapeAttr } from './utils/escape.js';
import { calcularIdade, formatarPesoKg } from './utils/format.js';
import { capitalizarPrimeira, normalizarTexto } from './utils/string.js';

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {HTMLElement} container
 * @param {{ userId: string, initialSparrings?: import('../domain/sparring.js').SparringInput[] }} options
 */
export async function mountSparringSection(client, container, options) {
  const acoesCatalogo = await listarAcoesTecnicas(client);
  const userId = options.userId;
  const dlAcoesId = 'dl-acoes-tecnicas';
  const base = document.createElement('div');
  base.innerHTML = `
    <datalist id="${dlAcoesId}"></datalist>
    <div id="sp-list"></div>
    <button type="button" class="btn btn-ghost" id="sp-add">+ Adicionar sparring</button>
  `;
  container.appendChild(base);

  const dlAcoes = /** @type {HTMLDataListElement} */ (base.querySelector(`#${dlAcoesId}`));
  function refreshDatalistAcoes() {
    dlAcoes.innerHTML = '';
    acoesCatalogo.forEach((a) => {
      const o = document.createElement('option');
      o.value = a.nome;
      dlAcoes.appendChild(o);
    });
  }
  refreshDatalistAcoes();

  const listEl = /** @type {HTMLElement} */ (base.querySelector('#sp-list'));

  let spIndex = 0;

  /**
   * @param {HTMLElement} card
   * @param {number} nivelSparring
   * @param {string} idSuffix
   */
  function bindSparringSlider(card, nivelSparring, idSuffix) {
    const r = /** @type {HTMLInputElement} */ (card.querySelector(`#sp-nivel-${idSuffix}`));
    const v = /** @type {HTMLElement} */ (card.querySelector(`#sp-nivel-val-${idSuffix}`));
    if (r && v) {
      r.value = String(nivelSparring);
      v.textContent = r.value;
      r.addEventListener('input', () => {
        v.textContent = r.value;
      });
    }
  }

  /**
   * @param {import('../domain/sparring.js').SparringInput} [initial]
   */
  function addSparringCard(initial) {
    const sp = initial ?? sparringPadrao();
    const parceiro = sp.parceiroTreino;
    const idSuffix = `${spIndex++}`;
    const card = document.createElement('div');
    card.className = 'sparring-card';
    card.dataset.sparringCard = '';
    if (parceiro?.id) card.dataset.parceiroId = parceiro.id;
    card.innerHTML = `
      <h3>Sparring</h3>
      <div class="row">
        <label>Duração (MM:SS)</label>
        <input type="text" name="duracao" placeholder="7:00" value="${escapeAttr(sp.duracaoMmSs)}" />
      </div>
      <div class="row">
        <label>Nível de sparring (1–3)</label>
        <div class="slider-row">
          <input type="range" id="sp-nivel-${idSuffix}" min="1" max="3" step="1" value="${sp.nivelSparring}" />
          <span class="slider-val" id="sp-nivel-val-${idSuffix}">${sp.nivelSparring}</span>
        </div>
      </div>
      <div class="row">
        <label>Início</label>
        <select name="inicio">
          <option value="${SPARRING_INICIO.GUARDA}" ${sp.inicio === SPARRING_INICIO.GUARDA ? 'selected' : ''}>Guarda</option>
          <option value="${SPARRING_INICIO.PASSAGEM}" ${sp.inicio === SPARRING_INICIO.PASSAGEM ? 'selected' : ''}>Passagem</option>
        </select>
      </div>
      <div class="row">
        <label>Parceiro de treino</label>
        <input type="text" name="parceiro-nome" placeholder="Digite para buscar (ex.: Ma)" value="${escapeAttr(
          parceiro?.nome ?? '',
        )}" autocomplete="off" />
        <div class="autocomplete-list" data-parceiro-sugestoes hidden></div>
      </div>
      <div class="row parceiro-grid">
        <div>
          <label>Sexo</label>
          <select name="parceiro-sexo">
            <option value="M" ${parceiro?.sexo === 'M' || !parceiro?.sexo ? 'selected' : ''}>M</option>
            <option value="F" ${parceiro?.sexo === 'F' ? 'selected' : ''}>F</option>
          </select>
        </div>
        <div>
          <label>Aniversário</label>
          <input type="date" name="parceiro-aniversario" value="${escapeAttr(parceiro?.aniversario ?? '')}" />
          <div class="text-muted parceiro-idade" data-parceiro-idade></div>
        </div>
        <div>
          <label>Faixa</label>
          <select name="parceiro-faixa">
            <option value="branca" ${parceiro?.faixa === 'branca' || !parceiro?.faixa ? 'selected' : ''}>Branca</option>
            <option value="azul" ${parceiro?.faixa === 'azul' ? 'selected' : ''}>Azul</option>
            <option value="roxa" ${parceiro?.faixa === 'roxa' ? 'selected' : ''}>Roxa</option>
            <option value="marrom" ${parceiro?.faixa === 'marrom' ? 'selected' : ''}>Marrom</option>
            <option value="preta" ${parceiro?.faixa === 'preta' ? 'selected' : ''}>Preta</option>
          </select>
        </div>
        <div>
          <label>Peso (kg)</label>
          <input type="number" name="parceiro-peso" min="1" step="0.1" value="${parceiro?.pesoKg ?? ''}" />
        </div>
      </div>
      <div class="row">
        <label>Observações <span class="text-muted">(opcional)</span></label>
        <textarea name="obs" rows="2" placeholder="Notas do round"></textarea>
      </div>
      <div class="row">
        <label>Ações técnicas</label>
        <div class="acoes-root"></div>
        <button type="button" class="btn btn-ghost" data-add-acao>+ Ação técnica</button>
      </div>
      <button type="button" class="btn btn-danger btn-ghost" data-remove-sp>Remover sparring</button>
    `;
    listEl.appendChild(card);
    bindSparringSlider(card, sp.nivelSparring, idSuffix);

    const obsTxt = /** @type {HTMLTextAreaElement} */ (card.querySelector('[name=obs]'));
    if (obsTxt) obsTxt.value = sp.observacoes ?? '';

    const parceiroNomeInput = /** @type {HTMLInputElement} */ (card.querySelector('[name=parceiro-nome]'));
    const parceiroSexoInput = /** @type {HTMLSelectElement} */ (card.querySelector('[name=parceiro-sexo]'));
    const parceiroAniversarioInput = /** @type {HTMLInputElement} */ (card.querySelector('[name=parceiro-aniversario]'));
    const parceiroFaixaInput = /** @type {HTMLSelectElement} */ (card.querySelector('[name=parceiro-faixa]'));
    const parceiroPesoInput = /** @type {HTMLInputElement} */ (card.querySelector('[name=parceiro-peso]'));
    const parceiroIdadeEl = /** @type {HTMLElement} */ (card.querySelector('[data-parceiro-idade]'));
    const sugestoesEl = /** @type {HTMLElement} */ (card.querySelector('[data-parceiro-sugestoes]'));

    /** @type {number | undefined} */
    let autocompleteTimer;
    let buscaSeq = 0;

    /** @param {{ id: string, nome: string, sexo: 'M' | 'F', aniversario: string, faixa: string, pesoKg: number }} parceiroFound */
    function selecionarParceiro(parceiroFound) {
      card.dataset.parceiroId = parceiroFound.id;
      parceiroNomeInput.value = parceiroFound.nome;
      parceiroSexoInput.value = parceiroFound.sexo;
      parceiroAniversarioInput.value = parceiroFound.aniversario;
      parceiroFaixaInput.value = parceiroFound.faixa;
      parceiroPesoInput.value = String(parceiroFound.pesoKg);
      atualizarIdadeParceiro();
      sugestoesEl.hidden = true;
      sugestoesEl.innerHTML = '';
    }

    function atualizarIdadeParceiro() {
      const idade = calcularIdade(parceiroAniversarioInput.value);
      parceiroIdadeEl.textContent = Number.isFinite(idade) ? `Idade: ${idade} anos` : '';
    }

    /** @param {{ id: string, nome: string, faixa: string, pesoKg: number }[]} parceiros */
    function renderSugestoesParceiro(parceiros) {
      sugestoesEl.innerHTML = '';
      if (parceiros.length === 0) {
        sugestoesEl.hidden = true;
        return;
      }

      parceiros.forEach((parceiroFound) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'autocomplete-item';
        b.textContent = `${parceiroFound.nome} - ${capitalizarPrimeira(parceiroFound.faixa)} - ${formatarPesoKg(
          parceiroFound.pesoKg,
        )}`;
        b.addEventListener('mousedown', (ev) => ev.preventDefault());
        b.addEventListener('click', () => selecionarParceiro(parceiroFound));
        sugestoesEl.appendChild(b);
      });

      sugestoesEl.hidden = false;
    }

    parceiroNomeInput.addEventListener('input', () => {
      card.dataset.parceiroId = '';
      const termo = parceiroNomeInput.value.trim();
      if (autocompleteTimer) window.clearTimeout(autocompleteTimer);
      if (termo.length < 2) {
        sugestoesEl.hidden = true;
        sugestoesEl.innerHTML = '';
        return;
      }

      autocompleteTimer = window.setTimeout(async () => {
        const seq = ++buscaSeq;
        try {
          showLoader();
          const parceiros = await buscarParceirosTreinoPorPrefixo(client, userId, termo);
          hideLoader();
          if (seq !== buscaSeq) return;
          renderSugestoesParceiro(parceiros);
        } catch {
          hideLoader();
          if (seq !== buscaSeq) return;
          sugestoesEl.hidden = true;
          sugestoesEl.innerHTML = '';
        }
      }, 220);
    });

    parceiroNomeInput.addEventListener('blur', () => {
      window.setTimeout(() => {
        sugestoesEl.hidden = true;
      }, 120);
    });

    parceiroAniversarioInput.addEventListener('change', atualizarIdadeParceiro);
    atualizarIdadeParceiro();

    const acoesRoot = /** @type {HTMLElement} */ (card.querySelector('.acoes-root'));

    /**
     * @param {import('../domain/sparring.js').AcaoTecnicaContagem} [acao]
     */
    function addAcaoRow(acao) {
      const a = acao ?? { falha: 0, parcial: 0, sucesso: 0, acaoTecnicaNome: '' };
      const row = document.createElement('div');
      row.dataset.acaoRow = '';
      if (a.acaoTecnicaId) row.dataset.acaoId = String(a.acaoTecnicaId);
      row.innerHTML = `
        <div class="acao-grid">
          <div>
            <div class="head">Ação</div>
            <input type="text" name="acao-nome" list="${dlAcoesId}" placeholder="Nome da ação" value="${escapeAttr(
              a.acaoTecnicaNome ?? '',
            )}" />
          </div>
          <div>
            <div class="head">Falha</div>
            <input type="number" name="falha" min="0" step="1" value="${a.falha}" />
          </div>
          <div>
            <div class="head">Parcial</div>
            <input type="number" name="parcial" min="0" step="1" value="${a.parcial}" />
          </div>
          <div>
            <div class="head">Sucesso</div>
            <input type="number" name="sucesso" min="0" step="1" value="${a.sucesso}" />
          </div>
        </div>
        <button type="button" class="btn btn-ghost btn-acao-remove" data-remove-acao>Remover ação</button>
      `;
      acoesRoot.appendChild(row);

      const nomeInput = /** @type {HTMLInputElement} */ (row.querySelector('[name=acao-nome]'));
      if (!row.dataset.acaoId) {
        const nome = nomeInput.value.trim();
        const found = acoesCatalogo.find((x) => normalizarTexto(x.nome) === normalizarTexto(nome));
        if (found) row.dataset.acaoId = found.id;
      }
      nomeInput.addEventListener('blur', () => {
        const nome = nomeInput.value.trim();
        const found = acoesCatalogo.find((x) => normalizarTexto(x.nome) === normalizarTexto(nome));
        row.dataset.acaoId = found?.id ?? '';
      });

      row.querySelector('[data-remove-acao]')?.addEventListener('click', () => row.remove());
    }

    sp.acoes.forEach((a) => addAcaoRow(a));

    card.querySelector('[data-add-acao]')?.addEventListener('click', () => addAcaoRow());

    card.querySelector('[data-remove-sp]')?.addEventListener('click', () => {
      card.remove();
    });
  }

  base.querySelector('#sp-add')?.addEventListener('click', () => {
    addSparringCard();
  });

  const initialSparrings = options.initialSparrings;
  if (initialSparrings?.length) {
    for (const sp of initialSparrings) {
      addSparringCard(sp);
    }
  }

  return {
    /**
     * @returns {import('../domain/sparring.js').SparringInput[]}
     */
    getData() {
      const cards = /** @type {HTMLElement[]} */ ([...container.querySelectorAll('[data-sparring-card]')]);
      return cards.map((card) => {
        const duracao = /** @type {HTMLInputElement} */ (card.querySelector('[name=duracao]'));
        const nivel = /** @type {HTMLInputElement} */ (card.querySelector('input[type="range"]'));
        const inicio = /** @type {HTMLSelectElement} */ (card.querySelector('[name=inicio]'));
        const obs = /** @type {HTMLTextAreaElement} */ (card.querySelector('[name=obs]'));
        const acaoRows = /** @type {HTMLElement[]} */ ([...card.querySelectorAll('[data-acao-row]')]);
        const acoes = acaoRows
          .map((row) => ({
            acaoTecnicaId: row.dataset.acaoId || null,
            acaoTecnicaNome:
              /** @type {HTMLInputElement} */ (row.querySelector('[name=acao-nome]'))?.value?.trim() || null,
            falha: Number(/** @type {HTMLInputElement} */ (row.querySelector('[name=falha]'))?.value ?? 0),
            parcial: Number(/** @type {HTMLInputElement} */ (row.querySelector('[name=parcial]'))?.value ?? 0),
            sucesso: Number(/** @type {HTMLInputElement} */ (row.querySelector('[name=sucesso]'))?.value ?? 0),
          }))
          .filter((a) => a.acaoTecnicaId || (a.acaoTecnicaNome && a.acaoTecnicaNome.length > 0));
        return {
          duracaoMmSs: duracao?.value?.trim() || SPARRING_DURACAO_PADRAO,
          nivelSparring: Number(nivel?.value ?? 2),
          inicio:
            inicio?.value === SPARRING_INICIO.PASSAGEM ? SPARRING_INICIO.PASSAGEM : SPARRING_INICIO.GUARDA,
          parceiroTreino:
            /** @type {HTMLInputElement} */ (card.querySelector('[name=parceiro-nome]'))?.value?.trim()
              ? {
                  id: card.dataset.parceiroId?.trim() || null,
                  nome: /** @type {HTMLInputElement} */ (card.querySelector('[name=parceiro-nome]')).value.trim(),
                  sexo: /** @type {HTMLSelectElement} */ (card.querySelector('[name=parceiro-sexo]')).value === 'F' ? 'F' : 'M',
                  aniversario: /** @type {HTMLInputElement} */ (card.querySelector('[name=parceiro-aniversario]')).value,
                  faixa: /** @type {'branca' | 'azul' | 'roxa' | 'marrom' | 'preta'} */ (
                    /** @type {HTMLSelectElement} */ (card.querySelector('[name=parceiro-faixa]')).value
                  ),
                  pesoKg: Number(/** @type {HTMLInputElement} */ (card.querySelector('[name=parceiro-peso]')).value),
                }
              : undefined,
          observacoes: obs?.value?.trim() || undefined,
          acoes,
        };
      });
    },
  };
}
