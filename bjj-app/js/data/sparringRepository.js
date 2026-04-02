import { parseDuracaoMmSs } from '../domain/sparring.js';
import { encontrarOuCriarAcaoTecnica } from './acaoTecnicaRepository.js';
import { encontrarOuCriarParceiroTreino } from './parceiroTreinoRepository.js';

/**
 * @typedef {import('../domain/sparring.js').SparringInput} SparringInput
 */

export class SparringRepository {
  /**
   * @param {import('@supabase/supabase-js').SupabaseClient} client
   */
  constructor(client) {
    this.client = client;
  }

  /**
   * @param {string} registroTreinoId
   * @param {SparringInput[]} sparrings
   * @param {string} userId
   */
  /**
   * @param {string} registroTreinoId
   */
  async deleteByRegistroTreinoId(registroTreinoId) {
    const { error } = await this.client
      .from('sparring')
      .delete()
      .eq('registro_treino_id', registroTreinoId);
    if (error) throw error;
  }

  /**
   * @param {string} registroTreinoId
   * @param {SparringInput[]} sparrings
   * @param {string} userId
   */
  async replaceForRegistro(registroTreinoId, sparrings, userId) {
    await this.deleteByRegistroTreinoId(registroTreinoId);
    await this.createMany(registroTreinoId, sparrings, userId);
  }

  /**
   * @param {string} registroTreinoId
   * @param {SparringInput[]} sparrings
   * @param {string} userId
   */
  async createMany(registroTreinoId, sparrings, userId) {
    for (let i = 0; i < sparrings.length; i++) {
      const sp = sparrings[i];
      const dur = parseDuracaoMmSs(sp.duracaoMmSs);
      if (!dur.ok) throw new Error(dur.erro);

      let parceiroTreinoId = sp.parceiroTreino?.id?.trim() || null;
      if (!parceiroTreinoId && sp.parceiroTreino) {
        parceiroTreinoId = await encontrarOuCriarParceiroTreino(this.client, sp.parceiroTreino, userId);
      }

      const { data: row, error } = await this.client
        .from('sparring')
        .insert({
          registro_treino_id: registroTreinoId,
          duracao_mm_ss: String(sp.duracaoMmSs).trim(),
          duracao_segundos: dur.segundos,
          nivel_sparring: sp.nivelSparring,
          inicio: sp.inicio,
          parceiro_treino_id: parceiroTreinoId,
          observacoes: sp.observacoes ?? null,
          ordem: i,
        })
        .select('id')
        .single();
      if (error) throw error;

      const acoes = sp.acoes ?? [];
      for (let j = 0; j < acoes.length; j++) {
        const a = acoes[j];
        let acaoId = a.acaoTecnicaId?.trim() || null;
        if (!acaoId) {
          const nome = a.acaoTecnicaNome?.trim();
          if (!nome) throw new Error('Ação técnica sem nome.');
          acaoId = await encontrarOuCriarAcaoTecnica(this.client, nome, userId);
        }

        const { error: eAcao } = await this.client.from('sparring_acao').insert({
          sparring_id: row.id,
          acao_tecnica_id: acaoId,
          falha: a.falha,
          parcial: a.parcial,
          sucesso: a.sucesso,
          ordem: j,
        });
        if (eAcao) throw eAcao;
      }
    }
  }
}
