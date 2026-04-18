import { listarTiposTreino, listarVariacoesPorTipo } from '../data/tipoVariacaoRepository.js';
import { normalizarTexto } from './utils/string.js';

/**
 * @typedef {import('../domain/registroTreino.js').RegistroTreinoInput} RegistroTreinoInput
 * @typedef {import('../domain/registroTreino.js').ItemTipoVariacao} ItemTipoVariacao
 */

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {HTMLElement} container
 * @param {{ initial?: RegistroTreinoInput }} [options]
 */
export async function mountRegistroTreinoForm(client, container, options = {}) {
  const tipos = await listarTiposTreino(client);
  const tiposMap = new Map(tipos.map((t) => [normalizarTexto(t.nome), t]));

  const datalistTiposId = 'dl-tipos-treino';
  const base = document.createElement('div');
  base.innerHTML = `
    <div class="row">
      <label for="rt-modalidade">Modalidade</label>
      <select id="rt-modalidade">
        <option value="1">Gui</option>
        <option value="2">No Gui</option>
      </select>
    </div>
    <div class="row">
      <h2 class="form-block-title">Tipos de treino e variações</h2>
      <p class="form-hint">Ao menos um par tipo + variação. Você pode escolher existentes ou digitar um novo nome.</p>
      <datalist id="${datalistTiposId}"></datalist>
      <div id="rt-items"></div>
      <button type="button" class="btn btn-ghost" id="rt-add-item">+ Adicionar tipo / variação</button>
    </div>
    <div class="row">
      <label for="rt-tecnica">Técnica aprendida <span class="text-muted">(opcional)</span></label>
      <textarea id="rt-tecnica" rows="3" placeholder="O que você aprendeu hoje"></textarea>
    </div>
    <div class="row">
      <label for="rt-entendimento">Nível de entendimento das técnicas (1–5)</label>
      <div class="slider-row">
        <input type="range" id="rt-entendimento" min="1" max="5" step="1" value="5" />
        <span class="slider-val" id="rt-entendimento-val">5</span>
      </div>
    </div>
    <div class="row">
      <label for="rt-duvidas">Dúvidas <span class="text-muted">(opcional)</span></label>
      <textarea id="rt-duvidas" rows="2"></textarea>
    </div>
    <div class="row">
      <label for="rt-energia">Nível de energia (1–5)</label>
      <div class="slider-row">
        <input type="range" id="rt-energia" min="1" max="5" step="1" value="5" />
        <span class="slider-val" id="rt-energia-val">5</span>
      </div>
    </div>
    <div class="row">
      <label for="rt-foco">Nível de foco (1–5)</label>
      <div class="slider-row">
        <input type="range" id="rt-foco" min="1" max="5" step="1" value="5" />
        <span class="slider-val" id="rt-foco-val">5</span>
      </div>
    </div>
  `;
  container.appendChild(base);

  const dlTipos = /** @type {HTMLDataListElement} */ (base.querySelector(`#${datalistTiposId}`));
  tipos.forEach((t) => {
    const o = document.createElement('option');
    o.value = t.nome;
    dlTipos.appendChild(o);
  });

  const itemsEl = /** @type {HTMLElement} */ (base.querySelector('#rt-items'));

  function bindSlider(id, valId) {
    const r = /** @type {HTMLInputElement} */ (base.querySelector(`#${id}`));
    const v = /** @type {HTMLElement} */ (base.querySelector(`#${valId}`));
    r.addEventListener('input', () => {
      v.textContent = r.value;
    });
  }
  bindSlider('rt-entendimento', 'rt-entendimento-val');
  bindSlider('rt-energia', 'rt-energia-val');
  bindSlider('rt-foco', 'rt-foco-val');

  /**
   * @param {number} index
   * @param {ItemTipoVariacao} [initialItem]
   */
  async function addItemRow(index, initialItem) {
    const wrap = document.createElement('div');
    wrap.className = 'item-card';
    wrap.dataset.registroItem = '';
    const dlVarId = `dl-variacao-${index}-${Date.now()}`;
    wrap.innerHTML = `
      <h3>Tipo ${index + 1}</h3>
      <div class="row">
        <label>Tipo de treino</label>
        <input type="text" name="tipo" list="${datalistTiposId}" placeholder="Ex.: Guarda" autocomplete="off" />
      </div>
      <div class="row">
        <label>Variação</label>
        <input type="text" name="variacao" list="${dlVarId}" placeholder="Ex.: De La Riva" autocomplete="off" />
        <datalist id="${dlVarId}"></datalist>
      </div>
      <button type="button" class="btn btn-danger btn-ghost" data-remove>Remover</button>
    `;
    itemsEl.appendChild(wrap);

    const tipoInput = /** @type {HTMLInputElement} */ (wrap.querySelector('[name=tipo]'));
    const variacaoInput = /** @type {HTMLInputElement} */ (wrap.querySelector('[name=variacao]'));
    const dlVar = /** @type {HTMLDataListElement} */ (wrap.querySelector(`#${dlVarId}`));

    async function refreshVariacoes() {
      dlVar.innerHTML = '';
      const nomeTipo = tipoInput.value.trim();
      const tipo = tiposMap.get(normalizarTexto(nomeTipo));
      wrap.dataset.tipoId = tipo?.id ?? '';
      wrap.dataset.variacaoId = '';
      if (!tipo?.id) return;
      const vars = await listarVariacoesPorTipo(client, tipo.id);
      vars.forEach((v) => {
        const o = document.createElement('option');
        o.value = v.nome;
        dlVar.appendChild(o);
      });
    }

    tipoInput.addEventListener('change', () => {
      void refreshVariacoes();
    });
    tipoInput.addEventListener('blur', () => {
      const nomeTipo = tipoInput.value.trim();
      const tipo = tiposMap.get(normalizarTexto(nomeTipo));
      wrap.dataset.tipoId = tipo?.id ?? '';
      void refreshVariacoes();
    });

    variacaoInput.addEventListener('blur', async () => {
      const nomeTipo = tipoInput.value.trim();
      const tipo = tiposMap.get(normalizarTexto(nomeTipo));
      const nomeVar = variacaoInput.value.trim();
      if (!tipo?.id || !nomeVar) {
        wrap.dataset.variacaoId = '';
        return;
      }
      const vars = await listarVariacoesPorTipo(client, tipo.id);
      const found = vars.find((v) => normalizarTexto(v.nome) === normalizarTexto(nomeVar));
      wrap.dataset.variacaoId = found?.id ?? '';
    });

    wrap.querySelector('[data-remove]')?.addEventListener('click', () => {
      wrap.remove();
      if (!itemsEl.querySelector('[data-registro-item]')) void addItemRow(0);
    });

    if (initialItem) {
      tipoInput.value = initialItem.tipoTreinoNome ?? '';
      if (initialItem.tipoTreinoId) wrap.dataset.tipoId = String(initialItem.tipoTreinoId);
      await refreshVariacoes();
      variacaoInput.value = initialItem.variacaoNome ?? '';
      if (initialItem.variacaoId) wrap.dataset.variacaoId = String(initialItem.variacaoId);
    }
  }

  const initial = options.initial;
  if (initial?.itensTipoVariacao?.length) {
    for (let i = 0; i < initial.itensTipoVariacao.length; i++) {
      await addItemRow(i, initial.itensTipoVariacao[i]);
    }
  } else {
    await addItemRow(0);
  }

  if (initial) {
    const mod = /** @type {HTMLSelectElement} */ (base.querySelector('#rt-modalidade'));
    if (mod) mod.value = initial.modalidade ?? '';
    const ta = /** @type {HTMLTextAreaElement} */ (base.querySelector('#rt-tecnica'));
    if (ta) ta.value = initial.tecnicaAprendida ?? '';
    const du = /** @type {HTMLTextAreaElement} */ (base.querySelector('#rt-duvidas'));
    if (du) du.value = initial.duvidas ?? '';
    const e = /** @type {HTMLInputElement} */ (base.querySelector('#rt-entendimento'));
    const ev = base.querySelector('#rt-entendimento-val');
    if (e && ev) {
      e.value = String(initial.nivelEntendimento);
      ev.textContent = e.value;
    }
    const en = /** @type {HTMLInputElement} */ (base.querySelector('#rt-energia'));
    const env = base.querySelector('#rt-energia-val');
    if (en && env) {
      en.value = String(initial.nivelEnergia);
      env.textContent = en.value;
    }
    const f = /** @type {HTMLInputElement} */ (base.querySelector('#rt-foco'));
    const fv = base.querySelector('#rt-foco-val');
    if (f && fv) {
      f.value = String(initial.nivelFoco);
      fv.textContent = f.value;
    }
  }

  base.querySelector('#rt-add-item')?.addEventListener('click', () => {
    const n = itemsEl.querySelectorAll('[data-registro-item]').length;
    void addItemRow(n);
  });

  return {
    /**
     * @returns {RegistroTreinoInput}
     */
    getData() {
      const rows = /** @type {HTMLElement[]} */ ([
        ...container.querySelectorAll('[data-registro-item]'),
      ]);
      const itensTipoVariacao = rows.map((row) => {
        const tipo = /** @type {HTMLInputElement} */ (row.querySelector('[name=tipo]'));
        const variacao = /** @type {HTMLInputElement} */ (row.querySelector('[name=variacao]'));
        return {
          tipoTreinoId: row.dataset.tipoId || null,
          tipoTreinoNome: tipo?.value?.trim() || null,
          variacaoId: row.dataset.variacaoId || null,
          variacaoNome: variacao?.value?.trim() || null,
        };
      });

      const tecnica =
        /** @type {HTMLTextAreaElement} */ (container.querySelector('#rt-tecnica'))?.value?.trim() || undefined;
      return {
        modalidade: container.querySelector('#rt-modalidade')?.value ?? 1,
        itensTipoVariacao,
        tecnicaAprendida: tecnica,
        nivelEntendimento: Number(
          /** @type {HTMLInputElement} */(container.querySelector('#rt-entendimento'))?.value ?? 5,
        ),
        duvidas:
          /** @type {HTMLTextAreaElement} */ (container.querySelector('#rt-duvidas'))?.value?.trim() ||
          undefined,
        nivelEnergia: Number(
          /** @type {HTMLInputElement} */(container.querySelector('#rt-energia'))?.value ?? 5,
        ),
        nivelFoco: Number(/** @type {HTMLInputElement} */(container.querySelector('#rt-foco'))?.value ?? 5),
      };
    },
  };
}
