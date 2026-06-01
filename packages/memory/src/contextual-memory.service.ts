// CONTEXTUAL — "google interno": fragmentos recuperados por similaridade.
// impl embedding (pgvector). Consulta sob demanda.
//
// A política (limiar, max_fragmentos) guarda o cenário IRRELEVANTE:
// "limiar baixo demais polui o contexto". Fragmentos abaixo do limiar são descartados.
// Particionável por scopeId (opcional — null = base global compartilhada).
import type { ContextualFragment, ScopeId } from '@harness/types'
import { getPool } from './pool.js'

/** Injeta o provedor de embedding (DI) — o serviço não conhece o modelo. */
export type Embedder = (text: string) => Promise<number[]>

export interface ContextualPolicy {
  limiar: number
  maxFragmentos: number
}

export class ContextualMemoryService {
  private ready = false

  constructor(
    private readonly embed: Embedder,
    private readonly policy: ContextualPolicy,
    /** dimensão do vetor de embedding (ex: 1536) */
    private readonly dim: number,
  ) {}

  private async setup(): Promise<void> {
    if (this.ready) return
    const pool = getPool()
    await pool.query(`CREATE EXTENSION IF NOT EXISTS vector`)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS contextual_fragments (
        id        TEXT PRIMARY KEY,
        scope_id  TEXT,
        content   TEXT NOT NULL,
        embedding vector(${this.dim}) NOT NULL,
        metadata  JSONB
      )
    `)
    this.ready = true
  }

  /** Indexa um fragmento. scopeId opcional (null = global). */
  async index(
    id: string,
    content: string,
    opts?: { scopeId?: ScopeId; metadata?: Record<string, unknown> },
  ): Promise<void> {
    await this.setup()
    const vec = await this.embed(content)
    await getPool().query(
      `INSERT INTO contextual_fragments (id, scope_id, content, embedding, metadata)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET scope_id = EXCLUDED.scope_id, content = EXCLUDED.content, embedding = EXCLUDED.embedding, metadata = EXCLUDED.metadata`,
      [id, opts?.scopeId ?? null, content, JSON.stringify(vec), opts?.metadata ? JSON.stringify(opts.metadata) : null],
    )
  }

  /**
   * Busca por similaridade. Aplica limiar + max_fragmentos da política.
   * Cosseno (<=>) do pgvector; score = 1 - distância.
   * Se scopeId passado, busca nesse scope + nos globais (scope_id IS NULL).
   */
  async query(text: string, scopeId?: ScopeId): Promise<ContextualFragment[]> {
    await this.setup()
    const vec = await this.embed(text)
    const scopeFilter = scopeId ? `WHERE scope_id = $3 OR scope_id IS NULL` : ``
    const params = scopeId
      ? [JSON.stringify(vec), this.policy.maxFragmentos, scopeId]
      : [JSON.stringify(vec), this.policy.maxFragmentos]
    const { rows } = await getPool().query(
      `SELECT id, content, metadata, 1 - (embedding <=> $1) AS score
       FROM contextual_fragments
       ${scopeFilter}
       ORDER BY embedding <=> $1
       LIMIT $2`,
      params,
    )
    return rows
      .map((r) => ({
        id: r.id,
        content: r.content,
        score: Number(r.score),
        metadata: r.metadata ?? undefined,
      }))
      // limiar: descarta o irrelevante antes de poluir o contexto
      .filter((f) => f.score >= this.policy.limiar)
  }
}
