/**
 * Entidade de domínio: Registro de treino.
 * Inclui pares tipo de treino + variação (múltiplos por registro).
 */

/** @typedef {{ tipoTreinoId?: string | null, tipoTreinoNome?: string | null, variacaoId?: string | null, variacaoNome?: string | null }} ItemTipoVariacao */

/**
 * @typedef {{
 *   itensTipoVariacao: ItemTipoVariacao[],
 *   tecnicaAprendida?: string,
 *   nivelEntendimento: number,
 *   duvidas?: string,
 *   nivelEnergia: number,
 *   nivelFoco: number,
 * }} RegistroTreinoInput
 */

export const TIPOS_TREINO_SEED_NOMES = [
  'Guarda',
  'Passagem',
  'Escape',
  'Finalização',
  'Queda',
  'Raspagem',
];

const SLIDER_MIN = 1;
const SLIDER_MAX = 5;

/**
 * @param {unknown} n
 * @returns {string|null}
 */
function trimStr(n) {
  if (n == null) return null;
  const s = String(n).trim();
  return s === '' ? null : s;
}

/**
 * @param {ItemTipoVariacao} item
 * @returns {boolean}
 */
export function itemTipoVariacaoTemTipo(item) {
  const id = trimStr(item.tipoTreinoId);
  const nome = trimStr(item.tipoTreinoNome);
  return Boolean(id || nome);
}

/**
 * @param {ItemTipoVariacao} item
 * @returns {boolean}
 */
export function itemTipoVariacaoTemVariacao(item) {
  const id = trimStr(item.variacaoId);
  const nome = trimStr(item.variacaoNome);
  return Boolean(id || nome);
}

/**
 * Pelo menos um par tipo + variação completo.
 * @param {RegistroTreinoInput} data
 * @returns {{ ok: true, value: RegistroTreinoInput } | { ok: false, erros: string[] }}
 */
export function validarRegistroTreino(data) {
  /** @type {string[]} */
  const erros = [];

  const itens = Array.isArray(data.itensTipoVariacao) ? data.itensTipoVariacao : [];
  if (itens.length === 0) {
    erros.push('Inclua ao menos um tipo de treino com variação.');
  }

  for (let i = 0; i < itens.length; i++) {
    const item = itens[i];
    if (!itemTipoVariacaoTemTipo(item)) {
      erros.push(`Item ${i + 1}: selecione ou cadastre um tipo de treino.`);
    }
    if (!itemTipoVariacaoTemVariacao(item)) {
      erros.push(`Item ${i + 1}: selecione ou cadastre uma variação.`);
    }
  }

  const ne = Number(data.nivelEntendimento);
  const ee = Number(data.nivelEnergia);
  const nf = Number(data.nivelFoco);
  const modalidade = Number(data.modalidade);
  if (!Number.isInteger(ne) || ne < SLIDER_MIN || ne > SLIDER_MAX) {
    erros.push('Nível de entendimento deve ser entre 1 e 5.');
  }
  if (!Number.isInteger(ee) || ee < SLIDER_MIN || ee > SLIDER_MAX) {
    erros.push('Nível de energia deve ser entre 1 e 5.');
  }
  if (!Number.isInteger(nf) || nf < SLIDER_MIN || nf > SLIDER_MAX) {
    erros.push('Nível de foco deve ser entre 1 e 5.');
  }
  if (!Number.isInteger(modalidade) || modalidade < 1 || modalidade > 2) {
    erros.push('Modalidade deve ser entre 1 e 2.');
  }

  if (erros.length > 0) return { ok: false, erros };

  /** @type {RegistroTreinoInput} */
  const value = {
    modalidade: modalidade,
    itensTipoVariacao: itens.map((item) => ({
      tipoTreinoId: trimStr(item.tipoTreinoId),
      tipoTreinoNome: trimStr(item.tipoTreinoNome),
      variacaoId: trimStr(item.variacaoId),
      variacaoNome: trimStr(item.variacaoNome),
    })),
    tecnicaAprendida: trimStr(data.tecnicaAprendida) ?? undefined,
    nivelEntendimento: ne,
    duvidas: trimStr(data.duvidas) ?? undefined,
    nivelEnergia: ee,
    nivelFoco: nf,
  };

  return { ok: true, value };
}

/**
 * @returns {RegistroTreinoInput}
 */
export function registroTreinoPadrao() {
  return {
    modalidade: 1,
    itensTipoVariacao: [
      {
        tipoTreinoId: null,
        tipoTreinoNome: null,
        variacaoId: null,
        variacaoNome: null,
      },
    ],
    tecnicaAprendida: undefined,
    nivelEntendimento: 5,
    duvidas: undefined,
    nivelEnergia: 5,
    nivelFoco: 5,
  };
}
