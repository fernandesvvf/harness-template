// LONGA — "caderno": fatos confirmados do domínio. Persiste sempre.
// impl arquivo (Postgres). Merge inteligente: acumula/atualiza, não duplica.
// Particionado por scopeId (genérico — chat usa userId, automação usa tenant/job/global).
import type { LongTermFact, ScopeId } from '@harness/types'
import { getPool } from './pool.js'

export class LongTermMemoryService {
  private ready = false

  private async setup(): Promise<void> {
    if (this.ready) return
    await getPool().query(`
      CREATE TABLE IF NOT EXISTS long_term_facts (
        scope_id   TEXT NOT NULL,
        key        TEXT NOT NULL,
        value      TEXT NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (scope_id, key)
      )
    `)
    this.ready = true
  }

  /** Grava/atualiza um fato. Upsert por (scope_id, key). */
  async upsert(scopeId: ScopeId, key: string, value: string): Promise<void> {
    await this.setup()
    await getPool().query(
      `INSERT INTO long_term_facts (scope_id, key, value, updated_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (scope_id, key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
      [scopeId, key, value],
    )
  }

  async getAll(scopeId: ScopeId): Promise<LongTermFact[]> {
    await this.setup()
    const { rows } = await getPool().query(
      `SELECT scope_id, key, value, updated_at FROM long_term_facts WHERE scope_id = $1 ORDER BY key`,
      [scopeId],
    )
    return rows.map((r) => ({
      scopeId: r.scope_id,
      key: r.key,
      value: r.value,
      updatedAt: new Date(r.updated_at).toISOString(),
    }))
  }

  /** Contexto formatado pra injetar no system prompt. */
  async getContextForPrompt(scopeId: ScopeId): Promise<string | undefined> {
    const facts = await this.getAll(scopeId)
    if (facts.length === 0) return undefined
    return facts.map((f) => `${f.key}: ${f.value}`).join('\n')
  }
}
