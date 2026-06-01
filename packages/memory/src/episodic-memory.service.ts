// EPISÓDICA — "diário": resumos de execuções passadas. Tempo configurável (ttl).
// impl arquivo (Postgres). Cada resumo expira conforme ttl_dias da política.
// Particionado por scopeId; cada execução tem seu runId.
import type { EpisodicSummary, ScopeId } from '@harness/types'
import { getPool } from './pool.js'

export class EpisodicMemoryService {
  private ready = false

  /** @param ttlDays dias até expirar; null = nunca (vem do memory.md). */
  constructor(private readonly ttlDays: number | null = 30) {}

  private async setup(): Promise<void> {
    if (this.ready) return
    await getPool().query(`
      CREATE TABLE IF NOT EXISTS episodic_summaries (
        run_id     TEXT PRIMARY KEY,
        scope_id   TEXT NOT NULL,
        summary    TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        expires_at TIMESTAMPTZ
      )
    `)
    this.ready = true
  }

  async store(scopeId: ScopeId, runId: string, summary: string): Promise<void> {
    await this.setup()
    const expiresAt =
      this.ttlDays === null ? null : new Date(Date.now() + this.ttlDays * 86_400_000).toISOString()
    await getPool().query(
      `INSERT INTO episodic_summaries (run_id, scope_id, summary, expires_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (run_id) DO UPDATE SET summary = EXCLUDED.summary, expires_at = EXCLUDED.expires_at`,
      [runId, scopeId, summary, expiresAt],
    )
  }

  /** Resumos vivos (não expirados), mais recentes primeiro. */
  async getRecent(scopeId: ScopeId, limit = 5): Promise<EpisodicSummary[]> {
    await this.setup()
    const { rows } = await getPool().query(
      `SELECT run_id, scope_id, summary, created_at, expires_at
       FROM episodic_summaries
       WHERE scope_id = $1 AND (expires_at IS NULL OR expires_at > now())
       ORDER BY created_at DESC
       LIMIT $2`,
      [scopeId, limit],
    )
    return rows.map((r) => ({
      scopeId: r.scope_id,
      runId: r.run_id,
      summary: r.summary,
      createdAt: new Date(r.created_at).toISOString(),
      expiresAt: r.expires_at ? new Date(r.expires_at).toISOString() : null,
    }))
  }

  /** Contexto formatado dos resumos recentes pra injetar no prompt. */
  async getContextForPrompt(scopeId: ScopeId, limit = 3): Promise<string | undefined> {
    const recent = await this.getRecent(scopeId, limit)
    if (recent.length === 0) return undefined
    return recent.map((r) => `- ${r.summary}`).join('\n')
  }

  /** Remove expirados. Chamar periodicamente — guarda o cenário PERIGOSA (fato desatualizado). */
  async purgeExpired(): Promise<number> {
    await this.setup()
    const { rowCount } = await getPool().query(
      `DELETE FROM episodic_summaries WHERE expires_at IS NOT NULL AND expires_at <= now()`,
    )
    return rowCount ?? 0
  }
}
