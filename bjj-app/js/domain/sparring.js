/**
 * Entidade de domínio: Sparring (ligado a um RegistroTreino).
 */

/** @typedef {{ acaoTecnicaId?: string | null, acaoTecnicaNome?: string | null, falha: number, parcial: number, sucesso: number }} AcaoTecnicaContagem */

/**
 * @typedef {{
 *   duracaoMmSs: string,
 *   nivelSparring: number,
 *   inicio: 'Guarda' | 'Passagem',
 *   observacoes?: string,
 *   acoes: AcaoTecnicaContagem[],
 * }} SparringInput
 */

export const SPARRING_INICIO = /** @type {const} */ ({
  GUARDA: 'Guarda',
  PASSAGEM: 'Passagem',
});

export const SPARRING_DURACAO_PADRAO = '7:00';

const NIVEL_SPARRING_MIN = 1;
const NIVEL_SPARRING_MAX = 3;

/**
 * @param {string} mmSs
 * @returns {{ ok: true, segundos: number } | { ok: false, erro: string }}
 */
export function parseDuracaoMmSs(mmSs) {
  const s = String(mmSs).trim();
  const m = /^(\d+):([0-5]?\d)$/.exec(s);
  if (!m) {
    return { ok: false, erro: 'Use o formato MM:SS (ex.: 7:00 ou 06:30).' };
  }
  const min = parseInt(m[1], 10);
  const sec = parseInt(m[2], 10);
  const total = min * 60 + sec;
  return { ok: true, segundos: total };
}

/**
 * @param {SparringInput} data
 * @returns {{ ok: true, value: SparringInput } | { ok: false, erros: string[] }}
 */
export function validarSparring(data) {
  /** @type {string[]} */
  const erros = [];

  const dur = parseDuracaoMmSs(data.duracaoMmSs ?? '');
  if (!dur.ok) erros.push(dur.erro);

  const ns = Number(data.nivelSparring);
  if (!Number.isInteger(ns) || ns < NIVEL_SPARRING_MIN || ns > NIVEL_SPARRING_MAX) {
    erros.push('Nível de sparring deve ser entre 1 e 3.');
  }

  if (data.inicio !== SPARRING_INICIO.GUARDA && data.inicio !== SPARRING_INICIO.PASSAGEM) {
    erros.push('Início deve ser Guarda ou Passagem.');
  }

  const acoes = Array.isArray(data.acoes) ? data.acoes : [];
  for (let i = 0; i < acoes.length; i++) {
    const a = acoes[i];
    const nomeId =
      (a.acaoTecnicaId && String(a.acaoTecnicaId).trim()) ||
      (a.acaoTecnicaNome && String(a.acaoTecnicaNome).trim());
    if (!nomeId) {
      erros.push(`Ação ${i + 1}: informe uma ação técnica (existente ou nova).`);
    }
    for (const campo of ['falha', 'parcial', 'sucesso']) {
      const v = Number(a[campo]);
      if (!Number.isInteger(v) || v < 0) {
        erros.push(`Ação ${i + 1}: ${campo} deve ser um inteiro ≥ 0.`);
      }
    }
  }

  if (erros.length > 0) return { ok: false, erros };

  /** @type {SparringInput} */
  const value = {
    duracaoMmSs: String(data.duracaoMmSs).trim(),
    nivelSparring: ns,
    inicio: data.inicio,
    observacoes: data.observacoes?.trim() || undefined,
    acoes: acoes.map((a) => ({
      acaoTecnicaId: a.acaoTecnicaId?.trim() || null,
      acaoTecnicaNome: a.acaoTecnicaNome?.trim() || null,
      falha: Number(a.falha),
      parcial: Number(a.parcial),
      sucesso: Number(a.sucesso),
    })),
  };

  return { ok: true, value };
}

/**
 * @returns {SparringInput}
 */
export function sparringPadrao() {
  return {
    duracaoMmSs: SPARRING_DURACAO_PADRAO,
    nivelSparring: 2,
    inicio: SPARRING_INICIO.GUARDA,
    observacoes: undefined,
    acoes: [],
  };
}
