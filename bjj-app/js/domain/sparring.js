/**
 * Entidade de domínio: Sparring (ligado a um RegistroTreino).
 */

import { normalizarFaixaParceiro } from './utils/parceiro.js';
import { trimToNull } from './utils/string.js';

/** @typedef {{ acaoTecnicaId?: string | null, acaoTecnicaNome?: string | null, falha: number, parcial: number, sucesso: number }} AcaoTecnicaContagem */
/** @typedef {'M' | 'F'} ParceiroTreinoSexo */
/** @typedef {'branca' | 'azul' | 'roxa' | 'marrom' | 'preta'} ParceiroTreinoFaixa */
/** @typedef {{ id?: string | null, nome: string, sexo: ParceiroTreinoSexo, aniversario: string, faixa: ParceiroTreinoFaixa, pesoKg: number }} ParceiroTreinoInput */

/**
 * @typedef {{
 *   duracaoMmSs: string,
 *   nivelSparring: number,
 *   inicio: 'Guarda' | 'Passagem',
 *   parceiroTreino?: ParceiroTreinoInput,
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

  const parceiro = data.parceiroTreino;
  if (parceiro) {
    const nomeParceiro = trimToNull(parceiro.nome);
    if (!nomeParceiro) {
      erros.push('Nome do parceiro é obrigatório.');
    }

    if (parceiro.sexo !== 'M' && parceiro.sexo !== 'F') {
      erros.push('Sexo do parceiro deve ser M ou F.');
    }

    const aniversario = String(parceiro.aniversario ?? '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(aniversario)) {
      erros.push('Aniversário do parceiro deve estar no formato AAAA-MM-DD.');
    } else {
      const [yy, mm, dd] = aniversario.split('-').map(Number);
      const dt = new Date(yy, mm - 1, dd);
      if (dt.getFullYear() !== yy || dt.getMonth() !== mm - 1 || dt.getDate() !== dd) {
        erros.push('Aniversário do parceiro é inválido.');
      }
    }

    const faixa = normalizarFaixaParceiro(parceiro.faixa);
    if (!['branca', 'azul', 'roxa', 'marrom', 'preta'].includes(faixa)) {
      erros.push('Faixa do parceiro deve ser branca, azul, roxa, marrom ou preta.');
    }

    const peso = Number(parceiro.pesoKg);
    if (!Number.isFinite(peso) || peso <= 0) {
      erros.push('Peso do parceiro deve ser maior que zero.');
    }
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
    parceiroTreino: parceiro
      ? {
          id: trimToNull(parceiro.id),
          nome: String(parceiro.nome ?? '').trim(),
          sexo: parceiro.sexo,
          aniversario: String(parceiro.aniversario ?? '').trim(),
          faixa: /** @type {ParceiroTreinoFaixa} */ (normalizarFaixaParceiro(parceiro.faixa)),
          pesoKg: Number(parceiro.pesoKg),
        }
      : undefined,
    observacoes: data.observacoes?.trim() || undefined,
    acoes: acoes.map((a) => ({
      acaoTecnicaId: trimToNull(a.acaoTecnicaId),
      acaoTecnicaNome: trimToNull(a.acaoTecnicaNome),
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
    parceiroTreino: undefined,
    observacoes: undefined,
    acoes: [],
  };
}
