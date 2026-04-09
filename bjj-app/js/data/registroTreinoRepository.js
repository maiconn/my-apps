import {
  encontrarOuCriarTipoTreino,
  encontrarOuCriarVariacao,
} from './tipoVariacaoRepository.js';

/**
 * @typedef {import('../domain/registroTreino.js').RegistroTreinoInput} RegistroTreinoInput
 * @typedef {import('../domain/registroTreino.js').ItemTipoVariacao} ItemTipoVariacao
 */

/**
 * @typedef {{
 *   id: string,
 *   dataTreino: string,
 *   form: RegistroTreinoInput,
 *   sparrings: import('../domain/sparring.js').SparringInput[],
 * }} RegistroTreinoCarregado
 */

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {ItemTipoVariacao} item
 * @param {string} userId
 * @returns {Promise<{ tipoTreinoId: string, variacaoId: string }>}
 */
async function resolverItem(client, item, userId) {
  let tipoId = item.tipoTreinoId?.trim() || null;
  let varId = item.variacaoId?.trim() || null;

  if (varId && !tipoId) {
    const { data: v, error: e1 } = await client
      .from('variacao')
      .select('tipo_treino_id')
      .eq('id', varId)
      .maybeSingle();
    if (e1) throw e1;
    if (!v) throw new Error('Variação não encontrada.');
    tipoId = v.tipo_treino_id;
  }

  if (!tipoId) {
    const nome = item.tipoTreinoNome?.trim();
    if (!nome) throw new Error('Tipo de treino obrigatório.');
    tipoId = await encontrarOuCriarTipoTreino(client, nome, userId);
  }

  if (!varId) {
    const vnome = item.variacaoNome?.trim();
    if (!vnome) throw new Error('Variação obrigatória.');
    varId = await encontrarOuCriarVariacao(client, tipoId, vnome, userId);
  }

  const { data: vRow, error: e2 } = await client
    .from('variacao')
    .select('tipo_treino_id')
    .eq('id', varId)
    .maybeSingle();
  if (e2) throw e2;
  if (!vRow) throw new Error('Variação não encontrada.');
  if (vRow.tipo_treino_id !== tipoId) {
    throw new Error('A variação selecionada não pertence ao tipo de treino.');
  }

  return { tipoTreinoId: tipoId, variacaoId: varId };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} registroId
 * @param {RegistroTreinoInput} registro
 * @param {string} userId
 */
async function inserirItens(client, registroId, registro, userId) {
  const itens = registro.itensTipoVariacao ?? [];
  for (let i = 0; i < itens.length; i++) {
    const resolved = await resolverItem(client, itens[i], userId);
    const { error: eItem } = await client.from('registro_treino_item').insert({
      registro_treino_id: registroId,
      tipo_treino_id: resolved.tipoTreinoId,
      variacao_id: resolved.variacaoId,
      ordem: i,
    });
    if (eItem) throw eItem;
  }
}

export class RegistroTreinoRepository {
  /**
   * @param {import('@supabase/supabase-js').SupabaseClient} client
   */
  constructor(client) {
    this.client = client;
  }

  /**
   * @param {string} userId
   * @param {RegistroTreinoInput} registro
   * @param {string} dataTreinoIso YYYY-MM-DD
   * @returns {Promise<{ id: string }>}
   */
  async create(userId, registro, dataTreinoIso) {
    const { data: row, error } = await this.client
      .from('registro_treino')
      .insert({
        user_id: userId,
        data_treino: dataTreinoIso,
        tecnica_aprendida: registro.tecnicaAprendida ?? null,
        nivel_entendimento: registro.nivelEntendimento,
        duvidas: registro.duvidas ?? null,
        nivel_energia: registro.nivelEnergia,
        nivel_foco: registro.nivelFoco,
        modalidade: registro.modalidade
      })
      .select('id')
      .single();
    if (error) throw error;

    await inserirItens(this.client, row.id, registro, userId);

    return { id: row.id };
  }

  /**
   * @param {string} userId
   * @param {string} registroId
   * @param {RegistroTreinoInput} registro
   */
  async updateFull(userId, registroId, registro) {
    const { error } = await this.client
      .from('registro_treino')
      .update({
        tecnica_aprendida: registro.tecnicaAprendida ?? null,
        nivel_entendimento: registro.nivelEntendimento,
        duvidas: registro.duvidas ?? null,
        nivel_energia: registro.nivelEnergia,
        nivel_foco: registro.nivelFoco,
        modalidade: registro.modalidade
      })
      .eq('id', registroId)
      .eq('user_id', userId);
    if (error) throw error;

    const { error: delItem } = await this.client
      .from('registro_treino_item')
      .delete()
      .eq('registro_treino_id', registroId);
    if (delItem) throw delItem;

    await inserirItens(this.client, registroId, registro, userId);
  }

  /**
   * @param {string} userId
   * @param {string} registroId
   */
  async deleteById(userId, registroId) {
    const { error } = await this.client
      .from('registro_treino')
      .delete()
      .eq('id', registroId)
      .eq('user_id', userId);
    if (error) throw error;
  }

  /**
   * @param {string} userId
   * @param {string} dataIso YYYY-MM-DD
   * @returns {Promise<string | null>} id do registro ou null
   */
  async findIdByUserAndData(userId, dataIso) {
    const { data, error } = await this.client
      .from('registro_treino')
      .select('id')
      .eq('user_id', userId)
      .eq('data_treino', dataIso)
      .maybeSingle();
    if (error) throw error;
    return data?.id ?? null;
  }

  /**
   * @param {string} userId
   * @param {number} year
   * @param {number} month 1–12
   * @returns {Promise<{ id: string, data_treino: string }[]>}
   */
  async listByMonth(userId, year, month) {
    const m = String(month).padStart(2, '0');
    const start = `${year}-${m}-01`;
    const last = new Date(year, month, 0).getDate();
    const end = `${year}-${m}-${String(last).padStart(2, '0')}`;
    const { data, error } = await this.client
      .from('registro_treino')
      .select('id, data_treino')
      .eq('user_id', userId)
      .gte('data_treino', start)
      .lte('data_treino', end);
    if (error) throw error;
    return data ?? [];
  }

  /**
   * @param {string} userId
   * @param {string} registroId
   * @returns {Promise<RegistroTreinoCarregado | null>}
   */
  async findByIdCompleto(userId, registroId) {
    return carregarRegistroCompleto(this.client, userId, registroId);
  }
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} userId
 * @param {string} registroId
 * @returns {Promise<RegistroTreinoCarregado | null>}
 */
/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} registroId
 * @returns {Promise<import('../domain/registroTreino.js').ItemTipoVariacao[]>}
 */
async function carregarItensTipoVariacao(client, registroId) {
  const { data: items, error: eItems } = await client
    .from('registro_treino_item')
    .select('ordem, tipo_treino_id, variacao_id, tipo_treino ( nome ), variacao ( nome )')
    .eq('registro_treino_id', registroId)
    .order('ordem', { ascending: true });

  if (!eItems && items) {
    return (items ?? []).map((row) => {
      const tt = /** @type {{ nome?: string } | null} */ (row.tipo_treino);
      const vv = /** @type {{ nome?: string } | null} */ (row.variacao);
      return {
        tipoTreinoId: row.tipo_treino_id,
        tipoTreinoNome: tt?.nome ?? null,
        variacaoId: row.variacao_id,
        variacaoNome: vv?.nome ?? null,
      };
    });
  }

  const { data: rowsPlain, error: ePlain } = await client
    .from('registro_treino_item')
    .select('ordem, tipo_treino_id, variacao_id')
    .eq('registro_treino_id', registroId)
    .order('ordem', { ascending: true });
  if (ePlain) throw ePlain;

  const plain = rowsPlain ?? [];
  if (plain.length === 0) return [];

  const tipoIds = [...new Set(plain.map((x) => x.tipo_treino_id))];
  const varIds = [...new Set(plain.map((x) => x.variacao_id))];

  const { data: tiposRows, error: eTipos } = await client.from('tipo_treino').select('id, nome').in('id', tipoIds);
  if (eTipos) throw eTipos;
  const { data: varsRows, error: eVars } = await client.from('variacao').select('id, nome').in('id', varIds);
  if (eVars) throw eVars;

  const mapTipo = new Map((tiposRows ?? []).map((t) => [t.id, t.nome]));
  const mapVar = new Map((varsRows ?? []).map((v) => [v.id, v.nome]));

  return plain.map((row) => ({
    tipoTreinoId: row.tipo_treino_id,
    tipoTreinoNome: mapTipo.get(row.tipo_treino_id) ?? null,
    variacaoId: row.variacao_id,
    variacaoNome: mapVar.get(row.variacao_id) ?? null,
  }));
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} registroId
 * @returns {Promise<import('../domain/sparring.js').SparringInput[]>}
 */
async function carregarSparrings(client, registroId) {
  const { data: spRows, error: eSp } = await client
    .from('sparring')
    .select(
      `
      id,
      duracao_mm_ss,
      nivel_sparring,
      inicio,
      parceiro_treino_id,
      observacoes,
      ordem,
      parceiro_treino (
        id,
        nome,
        sexo,
        aniversario,
        faixa,
        peso_kg
      ),
      sparring_acao (
        falha,
        parcial,
        sucesso,
        ordem,
        acao_tecnica_id,
        acao_tecnica ( nome )
      )
    `,
    )
    .eq('registro_treino_id', registroId)
    .order('ordem', { ascending: true });

  if (!eSp && spRows != null) {
    return mapearSparringsDeLinhas(spRows);
  }

  const { data: spPlain, error: eSpPlain } = await client
    .from('sparring')
    .select('id, duracao_mm_ss, nivel_sparring, inicio, parceiro_treino_id, observacoes, ordem')
    .eq('registro_treino_id', registroId)
    .order('ordem', { ascending: true });
  if (eSpPlain) throw eSpPlain;

  const spList = spPlain ?? [];
  /** @type {import('../domain/sparring.js').SparringInput[]} */
  const out = [];

  for (const row of spList) {
    let parceiroTreino = undefined;
    if (row.parceiro_treino_id) {
      const { data: parceiro, error: eParceiro } = await client
        .from('parceiro_treino')
        .select('id, nome, sexo, aniversario, faixa, peso_kg')
        .eq('id', row.parceiro_treino_id)
        .maybeSingle();
      if (eParceiro) throw eParceiro;
      if (parceiro) {
        parceiroTreino = {
          id: String(parceiro.id),
          nome: String(parceiro.nome),
          sexo: parceiro.sexo === 'F' ? 'F' : 'M',
          aniversario: String(parceiro.aniversario),
          faixa: normalizarFaixa(parceiro.faixa),
          pesoKg: Number(parceiro.peso_kg),
        };
      }
    }

    const { data: acoesRows, error: eAc } = await client
      .from('sparring_acao')
      .select('falha, parcial, sucesso, ordem, acao_tecnica_id')
      .eq('sparring_id', row.id)
      .order('ordem', { ascending: true });
    if (eAc) throw eAc;

    const acoesArr = acoesRows ?? [];
    const acaoIds = [...new Set(acoesArr.map((a) => a.acao_tecnica_id))];
    let nomesMap = new Map();
    if (acaoIds.length > 0) {
      const { data: acoesNome, error: eNome } = await client
        .from('acao_tecnica')
        .select('id, nome')
        .in('id', acaoIds);
      if (eNome) throw eNome;
      nomesMap = new Map((acoesNome ?? []).map((x) => [x.id, x.nome]));
    }

    const sorted = [...acoesArr].sort((a, b) => Number(a.ordem) - Number(b.ordem));
    out.push({
      duracaoMmSs: String(row.duracao_mm_ss ?? ''),
      nivelSparring: Number(row.nivel_sparring),
      inicio: row.inicio === 'Passagem' ? 'Passagem' : 'Guarda',
      parceiroTreino,
      observacoes: row.observacoes ? String(row.observacoes) : undefined,
      acoes: sorted.map((a) => ({
        acaoTecnicaId: a.acao_tecnica_id ? String(a.acao_tecnica_id) : null,
        acaoTecnicaNome: nomesMap.get(a.acao_tecnica_id) ? String(nomesMap.get(a.acao_tecnica_id)) : null,
        falha: Number(a.falha ?? 0),
        parcial: Number(a.parcial ?? 0),
        sucesso: Number(a.sucesso ?? 0),
      })),
    });
  }

  return out;
}

/**
 * @param {Record<string, unknown>[]} spRows
 */
function mapearSparringsDeLinhas(spRows) {
  return spRows.map((row) => {
    const acoesRaw = /** @type {unknown} */ (row.sparring_acao);
    const acoesArr = Array.isArray(acoesRaw) ? acoesRaw : [];
    const sorted = [...acoesArr].sort(
      (a, b) => Number(/** @type {Record<string, unknown>} */ (a).ordem) - Number(/** @type {Record<string, unknown>} */ (b).ordem),
    );
    return {
      duracaoMmSs: String(row.duracao_mm_ss ?? ''),
      nivelSparring: Number(row.nivel_sparring),
      inicio: row.inicio === 'Passagem' ? 'Passagem' : 'Guarda',
      parceiroTreino: mapearParceiro(/** @type {Record<string, unknown>} */ (row)),
      observacoes: row.observacoes ? String(row.observacoes) : undefined,
      acoes: sorted.map((a) => {
        const ar = /** @type {Record<string, unknown>} */ (a);
        const at = /** @type {{ nome?: string } | null} */ (ar.acao_tecnica);
        return {
          acaoTecnicaId: ar.acao_tecnica_id ? String(ar.acao_tecnica_id) : null,
          acaoTecnicaNome: at?.nome ? String(at.nome) : null,
          falha: Number(ar.falha ?? 0),
          parcial: Number(ar.parcial ?? 0),
          sucesso: Number(ar.sucesso ?? 0),
        };
      }),
    };
  });
}

/**
 * @param {Record<string, unknown>} row
 */
function mapearParceiro(row) {
  const raw = /** @type {unknown} */ (row.parceiro_treino);
  if (!raw || Array.isArray(raw)) return undefined;
  const p = /** @type {Record<string, unknown>} */ (raw);
  if (!p.id) return undefined;
  return {
    id: String(p.id),
    nome: String(p.nome ?? ''),
    sexo: p.sexo === 'F' ? 'F' : 'M',
    aniversario: String(p.aniversario ?? ''),
    faixa: normalizarFaixa(p.faixa),
    pesoKg: Number(p.peso_kg ?? 0),
  };
}

/**
 * @param {unknown} faixa
 */
function normalizarFaixa(faixa) {
  const s = String(faixa ?? '').toLowerCase();
  if (s === 'azul' || s === 'roxa' || s === 'marrom' || s === 'preta') return s;
  return 'branca';
}

export async function carregarRegistroCompleto(client, userId, registroId) {
  const { data: r, error } = await client
    .from('registro_treino')
    .select('id, data_treino, tecnica_aprendida, nivel_entendimento, duvidas, nivel_energia, nivel_foco, modalidade')
    .eq('id', registroId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!r) return null;

  const itensTipoVariacao = await carregarItensTipoVariacao(client, registroId);
  const sparrings = await carregarSparrings(client, registroId);

  /** @type {RegistroTreinoInput} */
  const form = {
    itensTipoVariacao,
    tecnicaAprendida: r.tecnica_aprendida ? String(r.tecnica_aprendida) : undefined,
    nivelEntendimento: Number(r.nivel_entendimento),
    duvidas: r.duvidas ? String(r.duvidas) : undefined,
    nivelEnergia: Number(r.nivel_energia),
    nivelFoco: Number(r.nivel_foco),
    modalidade: r.modalidade
  };

  return {
    id: r.id,
    dataTreino: String(r.data_treino),
    form,
    sparrings,
  };
}
