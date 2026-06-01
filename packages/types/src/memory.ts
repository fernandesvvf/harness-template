// Tipos dos 4 tipos de memória (slides "4 tipos de memória").
// O contrato memory.md governa qual está ligado e com que política.

export type MemoryType = 'curta' | 'longa' | 'episodica' | 'contextual'

/** Como cada tipo é persistido fisicamente. */
export type MemoryImpl = 'local' | 'arquivo' | 'embedding'

/** Fato confirmado do domínio (LONGA — "caderno", persiste sempre). */
export interface LongTermFact {
  userId: string
  key: string
  value: string
  updatedAt: string
}

/** Resumo de uma execução passada (EPISÓDICA — "diário", ttl configurável). */
export interface EpisodicSummary {
  userId: string
  runId: string
  summary: string
  createdAt: string
  /** quando expira; null = sem expiração */
  expiresAt: string | null
}

/** Fragmento recuperado por similaridade (CONTEXTUAL — "google interno"). */
export interface ContextualFragment {
  id: string
  content: string
  /** similaridade 0..1 com a query; comparada contra o limiar da política */
  score: number
  metadata?: Record<string, unknown>
}
