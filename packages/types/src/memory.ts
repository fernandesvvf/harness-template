// Tipos dos 4 tipos de memória (slides "4 tipos de memória").
// O contrato memory.md governa qual está ligado e com que política.

export type MemoryType = 'curta' | 'longa' | 'episodica' | 'contextual'

/** Como cada tipo é persistido fisicamente. */
export type MemoryImpl = 'local' | 'arquivo' | 'embedding'

/**
 * Chave de partição da memória — quem/o-que "possui" essa memória.
 * Genérico de propósito: não assume chat.
 *   chat:         scopeId = userId
 *   automação:    scopeId = tenantId | jobName | "global"
 *   multi-tenant: scopeId = orgId
 */
export type ScopeId = string

/** Fato confirmado do domínio (LONGA — "caderno", persiste sempre). */
export interface LongTermFact {
  scopeId: ScopeId
  key: string
  value: string
  updatedAt: string
}

/**
 * Entrada da EPISÓDICA — "diário", ttl configurável.
 * kind 'summary' = resumo de execução; 'lesson' = lição (reflexão evolutiva).
 * Lição só é gravada quando o resultado foi inesperado, e deve ser generalizável.
 */
export type EpisodicKind = 'summary' | 'lesson'

export interface EpisodicSummary {
  scopeId: ScopeId
  runId: string
  kind: EpisodicKind
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
