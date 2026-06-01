// Pool Postgres compartilhado pelos serviços de memória (LONGA/EPISÓDICA/CONTEXTUAL).
// Um Postgres (pgvector) serve os 3 tipos persistidos. DATABASE_URL no .env.
import pg from 'pg'

let pool: pg.Pool | null = null

export function getPool(): pg.Pool {
  if (!pool) {
    pool = new pg.Pool({
      connectionString:
        process.env.MEMORY_DATABASE_URL ??
        'postgresql://harness:harness@localhost:5432/harness_memory',
    })
  }
  return pool
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end()
    pool = null
  }
}
