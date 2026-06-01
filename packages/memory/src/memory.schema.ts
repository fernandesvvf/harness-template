// memory.schema — valida a política declarada no memory.md de cada projeto.
// Slide "4 tipos de memória": o contrato memory.md governa os 4 tipos;
// cada um declara sua política (impl, enabled, ttl, limiar...).
//
// Schema-First aplicado ao contrato de memória, igual ao contrato de eval.
import { z } from 'zod'

// CURTA — estado da execução. impl local; sem persistência.
const CurtaPolicy = z.object({
  tipo: z.literal('local'),
  enabled: z.literal(true).default(true),
})

// LONGA — fatos confirmados; persiste sempre. impl arquivo (pg).
const LongaPolicy = z.object({
  tipo: z.literal('arquivo'),
  enabled: z.boolean().default(false),
  store: z.enum(['pg']).default('pg'),
})

// EPISÓDICA — resumos de execuções; tempo configurável. impl arquivo (pg).
const EpisodicaPolicy = z.object({
  tipo: z.literal('arquivo'),
  enabled: z.boolean().default(false),
  store: z.enum(['pg']).default('pg'),
  /** ttl em dias; null = nunca expira */
  ttl_dias: z.number().int().positive().nullable().default(30),
})

// CONTEXTUAL — fragmentos por similaridade; consulta sob demanda. impl embedding (pgvector).
const ContextualPolicy = z.object({
  tipo: z.literal('embedding'),
  enabled: z.boolean().default(false),
  store: z.enum(['pgvector']).default('pgvector'),
  /** limiar de similaridade 0..1 — abaixo disso o fragmento é descartado.
   *  Guarda o cenário IRRELEVANTE ("limiar baixo demais polui o contexto"). */
  limiar: z.number().min(0).max(1).default(0.78),
  /** teto de fragmentos injetados por consulta — guarda IRRELEVANTE. */
  max_fragmentos: z.number().int().positive().default(5),
})

export const MemoryContractSchema = z.object({
  memorias: z.object({
    curta: CurtaPolicy,
    longa: LongaPolicy,
    episodica: EpisodicaPolicy,
    contextual: ContextualPolicy,
  }),
})

export type MemoryContract = z.infer<typeof MemoryContractSchema>
export type ContextualPolicyT = z.infer<typeof ContextualPolicy>
export type EpisodicaPolicyT = z.infer<typeof EpisodicaPolicy>
