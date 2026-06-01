// LONGA — "caderno": fatos confirmados do domínio. Persiste sempre.
// impl arquivo (Postgres). Merge inteligente: acumula/atualiza, não duplica.
import type { LongTermFact } from '@harness/types'
import { getPool } from './pool.js'

export class LongTermMemoryService {
  private ready = false

  private async setup(): Promise<void> {
    if (this.ready) return
    await getPool().query(`
      CREATE TABLE IF NOT EXISTS long_term_facts (
        user_id    TEXT NOT NULL,
        key        TEXT NOT NULL,
        value      TEXT NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (user_id, key)
      )
    `)
    this.ready = true
  }

  /** Grava/atualiza um fato. Upsert por (user_id, key). */
  async upsert(userId: string, key: string, value: string): Promise<void> {
    await this.setup()
    await getPool().query(
      `INSERT INTO long_term_facts (user_id, key, value, updated_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (user_id, key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
      [userId, key, value],
    )
  }

  async getAll(userId: string): Promise<LongTermFact[]> {
    await this.setup()
    const { rows } = await getPool().query(
      `SELECT user_id, key, value, updated_at FROM long_term_facts WHERE user_id = $1 ORDER BY key`,
      [userId],
    )
    return rows.map((r) => ({
      userId: r.user_id,
      key: r.key,
      value: r.value,
      updatedAt: new Date(r.updated_at).toISOString(),
    }))
  }

  /** Contexto formatado pra injetar no system prompt. */
  async getContextForPrompt(userId: string): Promise<string | undefined> {
    const facts = await this.getAll(userId)
    if (facts.length === 0) return undefined
    return facts.map((f) => `${f.key}: ${f.value}`).join('\n')
  }
}
