// EPISÓDICA — "diário": resumos de execuções passadas. Tempo configurável (ttl).
// impl arquivo (Postgres). Cada entrada expira conforme ttl_dias da política.
// Particionado por scopeId; cada execução tem seu runId.
//
// kind='summary' → resumo do job. kind='lesson' → lição (reflexão evolutiva):
// só gravada quando o resultado foi inesperado; deve ser generalizável.
import type { EpisodicSummary, EpisodicKind, ScopeId } from '@harness/types'
import { getPool } from './pool.js'

export class EpisodicMemoryService {
  private ready = false

  /** @param ttlDays dias até expirar; null = nunca (vem do memory.md). */
  constructor(private readonly ttlDays: number | null = 30) {}

  private async setup(): Promise<void> {
    if (this.ready) return
    await getPool().query(`
      CREATE TABLE IF NOT EXISTS episodic_entries (
        id         BIGSERIAL PRIMARY KEY,
        run_id     TEXT NOT NULL,
        scope_id   TEXT NOT NULL,
        kind       TEXT NOT NULL DEFAULT 'summary',
        summary    TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        expires_at TIMESTAMPTZ
      )
    `)
    this.ready = true
  }

  async store(
    scopeId: ScopeId,
    runId: string,
    summary: string,
    kind: EpisodicKind = 'summary',
  ): Promise<void> {
    await this.setup()
    const expiresAt =
      this.ttlDays === null ? null : new Date(Date.now() + this.ttlDays * 86_400_000).toISOString()
    await getPool().query(
      `INSERT INTO episodic_entries (run_id, scope_id, kind, summary, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [runId, scopeId, kind, summary, expiresAt],
    )
  }

  /** Entradas vivas (não expiradas) de um kind, mais recentes primeiro. */
  async getRecent(scopeId: ScopeId, kind: EpisodicKind = 'summary', limit = 5): Promise<EpisodicSummary[]> {
    await this.setup()
    const { rows } = await getPool().query(
      `SELECT run_id, scope_id, kind, summary, created_at, expires_at
       FROM episodic_entries
       WHERE scope_id = $1 AND kind = $2 AND (expires_at IS NULL OR expires_at > now())
       ORDER BY created_at DESC
       LIMIT $3`,
      [scopeId, kind, limit],
    )
    return rows.map((r) => ({
      scopeId: r.scope_id,
      runId: r.run_id,
      kind: r.kind,
      summary: r.summary,
      createdAt: new Date(r.created_at).toISOString(),
      expiresAt: r.expires_at ? new Date(r.expires_at).toISOString() : null,
    }))
  }

  /** Contexto formatado dos resumos recentes pra injetar no prompt. */
  async getContextForPrompt(scopeId: ScopeId, limit = 3): Promise<string | undefined> {
    const recent = await this.getRecent(scopeId, 'summary', limit)
    if (recent.length === 0) return undefined
    return recent.map((r) => `- ${r.summary}`).join('\n')
  }

  /** Lições aprendidas (reflexão evolutiva) pra injetar no prompt. */
  async getLessonsForPrompt(scopeId: ScopeId, limit = 5): Promise<string | undefined> {
    const lessons = await this.getRecent(scopeId, 'lesson', limit)
    if (lessons.length === 0) return undefined
    return lessons.map((l) => `- ${l.summary}`).join('\n')
  }

  /** Todas as lições vivas — usado pelo batch consolidate-lessons (nível 2). */
  async getAllLessons(scopeId: ScopeId, limit = 100): Promise<EpisodicSummary[]> {
    return this.getRecent(scopeId, 'lesson', limit)
  }

  /** Remove expirados. Chamar periodicamente — guarda o cenário PERIGOSA. */
  async purgeExpired(): Promise<number> {
    await this.setup()
    const { rowCount } = await getPool().query(
      `DELETE FROM episodic_entries WHERE expires_at IS NOT NULL AND expires_at <= now()`,
    )
    return rowCount ?? 0
  }
}
