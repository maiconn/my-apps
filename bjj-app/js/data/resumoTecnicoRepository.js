/**
 * Persistencia: resumo tecnico por periodo e parceiro.
 */

import { isoLocalDate } from '../utils/date.js';

/**
 * @typedef {'ultimos-7' | 'ultimos-15' | 'ultimos-30' | 'custom' | 'todos'} TipoPeriodoResumo
 *
 * @typedef {{
 *   tipo: TipoPeriodoResumo,
 *   dataInicio?: string | null,
 *   dataFim?: string | null,
 * }} FiltroResumoTecnico
 *
 * @typedef {{
 *   parceiroId: string | null,
 *   parceiroNome: string,
 *   totalAcoes: number,
 *   falhaTotal: number,
 *   parcialTotal: number,
 *   sucessoTotal: number,
 * }} ParceiroAcaoResumo
 *
 * @typedef {{
 *   acaoTecnicaId: string,
 *   acaoTecnicaNome: string,
 *   totalAcoes: number,
 *   falhaTotal: number,
 *   parcialTotal: number,
 *   sucessoTotal: number,
 *   parceiros: ParceiroAcaoResumo[],
 * }} AcaoTecnicaResumo
 *
 * @typedef {{
 *   tipo: TipoPeriodoResumo,
 *   dataInicio: string | null,
 *   dataFim: string | null,
 *   acoes: AcaoTecnicaResumo[],
 * }} ResumoTecnicoResultado
 */

/**
 * @param {Date} base
 * @param {number} dias
 * @returns {string}
 */
function retrocederDiasIso(base, dias) {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  d.setDate(d.getDate() - dias);
  return isoLocalDate(d);
}

/**
 * @param {FiltroResumoTecnico} filtro
 * @returns {{ tipo: TipoPeriodoResumo, dataInicio: string | null, dataFim: string | null }}
 */
function resolverPeriodo(filtro) {
  const tipo = filtro.tipo;

  if (tipo === 'todos') {
    return { tipo, dataInicio: null, dataFim: null };
  }

  if (tipo === 'custom') {
    const inicio = String(filtro.dataInicio ?? '').trim();
    const fim = String(filtro.dataFim ?? '').trim();
    if (!inicio || !fim) {
      throw new Error('Informe data de inicio e data de fim para o periodo personalizado.');
    }
    if (inicio > fim) {
      throw new Error('A data de inicio nao pode ser maior que a data de fim.');
    }
    return {
      tipo,
      dataInicio: inicio,
      dataFim: fim,
    };
  }

  const hoje = new Date();
  const dataFim = isoLocalDate(hoje);

  if (tipo === 'ultimos-7') {
    return { tipo, dataInicio: retrocederDiasIso(hoje, 6), dataFim };
  }
  if (tipo === 'ultimos-15') {
    return { tipo, dataInicio: retrocederDiasIso(hoje, 14), dataFim };
  }
  if (tipo === 'ultimos-30') {
    return { tipo, dataInicio: retrocederDiasIso(hoje, 29), dataFim };
  }

  throw new Error('Tipo de periodo invalido.');
}

export class ResumoTecnicoRepository {
  /**
   * @param {import('@supabase/supabase-js').SupabaseClient} client
   */
  constructor(client) {
    this.client = client;
  }

  /**
   * @param {string} userId
   * @param {FiltroResumoTecnico} filtro
   * @returns {Promise<ResumoTecnicoResultado>}
   */
  async carregarResumo(userId, filtro) {
    const periodo = resolverPeriodo(filtro);

    let query = this.client
      .from('sparring')
      .select('id, parceiro_treino_id, parceiro_treino ( nome ), registro_treino!inner ( user_id, data_treino )')
      .eq('registro_treino.user_id', userId);

    if (periodo.dataInicio) {
      query = query.gte('registro_treino.data_treino', periodo.dataInicio);
    }
    if (periodo.dataFim) {
      query = query.lte('registro_treino.data_treino', periodo.dataFim);
    }

    const { data: sparringsRows, error: eSparrings } = await query;
    if (eSparrings) throw eSparrings;

    const sparrings = sparringsRows ?? [];
    if (sparrings.length === 0) {
      return {
        tipo: periodo.tipo,
        dataInicio: periodo.dataInicio,
        dataFim: periodo.dataFim,
        acoes: [],
      };
    }

    /** @type {Map<string, { parceiroId: string | null, parceiroNome: string }>} */
    const sparringInfo = new Map();

    for (const row of sparrings) {
      const parceiroRaw = /** @type {unknown} */ (row.parceiro_treino);
      let parceiroNome = 'Sem parceiro informado';

      if (parceiroRaw && !Array.isArray(parceiroRaw)) {
        const parceiroObj = /** @type {{ nome?: string } | null} */ (parceiroRaw);
        parceiroNome = parceiroObj?.nome ? String(parceiroObj.nome) : parceiroNome;
      }

      sparringInfo.set(String(row.id), {
        parceiroId: row.parceiro_treino_id ? String(row.parceiro_treino_id) : null,
        parceiroNome,
      });
    }

    const sparringIds = [...sparringInfo.keys()];

    const { data: acoesRows, error: eAcoes } = await this.client
      .from('sparring_acao')
      .select('sparring_id, acao_tecnica_id, falha, parcial, sucesso, acao_tecnica ( nome )')
      .in('sparring_id', sparringIds);
    if (eAcoes) throw eAcoes;

    /** @type {Map<string, AcaoTecnicaResumo & { parceirosMap: Map<string, ParceiroAcaoResumo> }>} */
    const acoesMap = new Map();

    for (const row of acoesRows ?? []) {
      const sparringId = String(row.sparring_id ?? '');
      const info = sparringInfo.get(sparringId);
      if (!info) continue;

      const falha = Number(row.falha ?? 0);
      const parcial = Number(row.parcial ?? 0);
      const sucesso = Number(row.sucesso ?? 0);
      const totalAcoes = falha + parcial + sucesso;

      const acaoId = String(row.acao_tecnica_id);
      const nestedAcao = /** @type {{ nome?: string } | null} */ (row.acao_tecnica);
      const acaoNome = nestedAcao?.nome ? String(nestedAcao.nome) : 'Acao sem nome';

      let agregado = acoesMap.get(acaoId);
      if (!agregado) {
        agregado = {
          acaoTecnicaId: acaoId,
          acaoTecnicaNome: acaoNome,
          totalAcoes: 0,
          falhaTotal: 0,
          parcialTotal: 0,
          sucessoTotal: 0,
          parceiros: [],
          parceirosMap: new Map(),
        };
        acoesMap.set(acaoId, agregado);
      }

      agregado.totalAcoes += totalAcoes;
      agregado.falhaTotal += falha;
      agregado.parcialTotal += parcial;
      agregado.sucessoTotal += sucesso;

      const parceiroKey = info.parceiroId ?? '__sem_parceiro__';
      const parceiroAtual = agregado.parceirosMap.get(parceiroKey);
      if (parceiroAtual) {
        parceiroAtual.totalAcoes += totalAcoes;
        parceiroAtual.falhaTotal += falha;
        parceiroAtual.parcialTotal += parcial;
        parceiroAtual.sucessoTotal += sucesso;
      } else {
        agregado.parceirosMap.set(parceiroKey, {
          parceiroId: info.parceiroId,
          parceiroNome: info.parceiroNome,
          totalAcoes,
          falhaTotal: falha,
          parcialTotal: parcial,
          sucessoTotal: sucesso,
        });
      }
    }

    const acoes = [...acoesMap.values()]
      .map((acao) => ({
        acaoTecnicaId: acao.acaoTecnicaId,
        acaoTecnicaNome: acao.acaoTecnicaNome,
        totalAcoes: acao.totalAcoes,
        falhaTotal: acao.falhaTotal,
        parcialTotal: acao.parcialTotal,
        sucessoTotal: acao.sucessoTotal,
        parceiros: [...acao.parceirosMap.values()].sort((a, b) => {
          if (b.totalAcoes !== a.totalAcoes) return b.totalAcoes - a.totalAcoes;
          return a.parceiroNome.localeCompare(b.parceiroNome, 'pt-BR');
        }),
      }))
      .sort((a, b) => {
        if (b.totalAcoes !== a.totalAcoes) return b.totalAcoes - a.totalAcoes;
        return a.acaoTecnicaNome.localeCompare(b.acaoTecnicaNome, 'pt-BR');
      });

    return {
      tipo: periodo.tipo,
      dataInicio: periodo.dataInicio,
      dataFim: periodo.dataFim,
      acoes,
    };
  }
}
