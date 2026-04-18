/**
 * Persistencia: consultas de sparring por parceiro.
 */

import { mapearParceiroTreinoComCreatedAt } from './utils/parceiroTreino.js';

/**
 * @typedef {'M' | 'F'} ParceiroTreinoSexo
 * @typedef {'branca' | 'azul' | 'roxa' | 'marrom' | 'preta'} ParceiroTreinoFaixa
 *
 * @typedef {{
 *   id: string,
 *   nome: string,
 *   sexo: ParceiroTreinoSexo,
 *   aniversario: string,
 *   faixa: ParceiroTreinoFaixa,
 *   pesoKg: number,
 *   createdAt: string,
 * }} ParceiroTreinoResumo
 *
 * @typedef {{
 *   acaoTecnicaId: string,
 *   acaoTecnicaNome: string,
 *   cadastros: number,
 *   falhaTotal: number,
 *   parcialTotal: number,
 *   sucessoTotal: number,
 *   total: number,
 * }} AcaoTecnicaConsolidada
 *
 * @typedef {{
 *   parceiro: ParceiroTreinoResumo,
 *   totalSparrings: number,
 *   acoesConsolidadas: AcaoTecnicaConsolidada[],
 * }} ResumoSparringPorParceiro
 */

export class SparringParceiroRepository {
  /**
   * @param {import('@supabase/supabase-js').SupabaseClient} client
   */
  constructor(client) {
    this.client = client;
  }

  /**
   * @param {string} userId
   * @returns {Promise<ParceiroTreinoResumo[]>}
   */
  async listarParceirosDoUsuario(userId) {
    const { data, error } = await this.client
      .from('parceiro_treino')
      .select('id, nome, sexo, aniversario, faixa, peso_kg, created_at')
      .eq('user_id', userId)
      .order('nome', { ascending: true });

    if (error) throw error;

    return (data ?? []).map((row) => mapearParceiroTreinoComCreatedAt(/** @type {Record<string, unknown>} */ (row)));
  }

  /**
   * @param {string} userId
   * @param {string} parceiroId
   * @returns {Promise<ResumoSparringPorParceiro>}
   */
  async carregarResumoPorParceiro(userId, parceiroId) {
    const parceiro = await this.buscarParceiro(userId, parceiroId);
    if (!parceiro) {
      throw new Error('Parceiro não encontrado para este usuário.');
    }

    const { data: sparringsRows, error: eSparring } = await this.client
      .from('sparring')
      .select('id, registro_treino!inner ( user_id )')
      .eq('parceiro_treino_id', parceiroId)
      .eq('registro_treino.user_id', userId)
      .order('ordem', { ascending: true });
    if (eSparring) throw eSparring;

    const sparrings = sparringsRows ?? [];
    if (sparrings.length === 0) {
      return {
        parceiro,
        totalSparrings: 0,
        acoesConsolidadas: [],
      };
    }

    const sparringIds = sparrings.map((s) => String(s.id));

    const { data: acoesRows, error: eAcoes } = await this.client
      .from('sparring_acao')
      .select('acao_tecnica_id, falha, parcial, sucesso, acao_tecnica ( nome )')
      .in('sparring_id', sparringIds);
    if (eAcoes) throw eAcoes;

    /** @type {Map<string, AcaoTecnicaConsolidada>} */
    const mapaAcoes = new Map();

    for (const row of acoesRows ?? []) {
      const acaoId = String(row.acao_tecnica_id);
      const nestedAcao = /** @type {{ nome?: string } | null} */ (row.acao_tecnica);
      const acaoNome = String(nestedAcao?.nome ?? 'Ação sem nome');
      const falha = Number(row.falha ?? 0);
      const parcial = Number(row.parcial ?? 0);
      const sucesso = Number(row.sucesso ?? 0);
      const total = falha + parcial + sucesso;

      const atual = mapaAcoes.get(acaoId);
      if (atual) {
        atual.cadastros += 1;
        atual.falhaTotal += falha;
        atual.parcialTotal += parcial;
        atual.sucessoTotal += sucesso;
        atual.total += total;
      } else {
        mapaAcoes.set(acaoId, {
          acaoTecnicaId: acaoId,
          acaoTecnicaNome: acaoNome,
          cadastros: 1,
          falhaTotal: falha,
          parcialTotal: parcial,
          sucessoTotal: sucesso,
          total,
        });
      }
    }

    const acoesConsolidadas = [...mapaAcoes.values()].sort((a, b) => {
      if (b.cadastros !== a.cadastros) return b.cadastros - a.cadastros;
      if (b.total !== a.total) return b.total - a.total;
      return a.acaoTecnicaNome.localeCompare(b.acaoTecnicaNome, 'pt-BR');
    });

    return {
      parceiro,
      totalSparrings: sparringIds.length,
      acoesConsolidadas,
    };
  }

  /**
   * @param {string} userId
   * @param {string} parceiroId
   * @returns {Promise<ParceiroTreinoResumo | null>}
   */
  async buscarParceiro(userId, parceiroId) {
    const { data, error } = await this.client
      .from('parceiro_treino')
      .select('id, nome, sexo, aniversario, faixa, peso_kg, created_at')
      .eq('id', parceiroId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return mapearParceiroTreinoComCreatedAt(/** @type {Record<string, unknown>} */ (data));
  }
}
