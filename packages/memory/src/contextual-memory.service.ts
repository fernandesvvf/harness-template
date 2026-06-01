// CONTEXTUAL — "google interno": fragmentos recuperados por similaridade.
// impl embedding (pgvector). Consulta sob demanda.
//
// A política (limiar, max_fragmentos) guarda o cenário IRRELEVANTE:
// "limiar baixo demais polui o contexto". Fragmentos abaixo do limiar são descartados.
import type { ContextualFragment } from '@harness/types'
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
        content   TEXT NOT NULL,
        embedding vector(${this.dim}) NOT NULL,
        metadata  JSONB
      )
    `)
    this.ready = true
  }

  /** Indexa um fragmento. */
  async index(id: string, content: string, metadata?: Record<string, unknown>): Promise<void> {
    await this.setup()
    const vec = await this.embed(content)
    await getPool().query(
      `INSERT INTO contextual_fragments (id, content, embedding, metadata)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content, embedding = EXCLUDED.embedding, metadata = EXCLUDED.metadata`,
      [id, content, JSON.stringify(vec), metadata ? JSON.stringify(metadata) : null],
    )
  }

  /**
   * Busca por similaridade. Aplica limiar + max_fragmentos da política.
   * Usa distância de cosseno (<=>) do pgvector; score = 1 - distância.
   */
  async query(text: string): Promise<ContextualFragment[]> {
    await this.setup()
    const vec = await this.embed(text)
    const { rows } = await getPool().query(
      `SELECT id, content, metadata, 1 - (embedding <=> $1) AS score
       FROM contextual_fragments
       ORDER BY embedding <=> $1
       LIMIT $2`,
      [JSON.stringify(vec), this.policy.maxFragmentos],
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
