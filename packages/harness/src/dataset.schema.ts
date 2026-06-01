// dataset.schema — eval orientada a DATASET (complementa os contratos YAML).
// Inspirado no material da aula: casos com ground-truth por dimensão.
//
//   memory_impact   → mede recall da memória (fatos/episódios/lições esperados)
//   tool_selection  → mede acerto na escolha de tools
//   behavior        → mede decisão/resultado esperados (comportamento geral)
//
// Diferença vs contrato YAML: aqui há GROUND-TRUTH explícito → score objetivo,
// sem depender de judge LLM. Os dois coexistem.
import { z } from 'zod'

// --- memory_impact ---------------------------------------------------------
// Declara QUAL memória deveria ser recuperada. O scorer compara com o que o
// agente realmente recuperou (recall/precision por tipo).
const MemoryCase = z.object({
  id: z.string(),
  entrada: z.string(),
  contexto_esperado: z.object({
    fatos_relevantes: z.array(z.string()).default([]),       // LONGA
    episodios_relevantes: z.array(z.string()).default([]),   // EPISÓDICA
    licoes_relevantes: z.array(z.string()).default([]),      // reflexão evolutiva
  }),
  decisao_esperada: z.string().optional(),
  resultado_esperado: z.string().optional(),
})

// --- tool_selection --------------------------------------------------------
const ToolCase = z.object({
  id: z.string(),
  entrada: z.string(),
  tools_esperadas: z.array(z.string()).default([]),     // devem ser chamadas
  tools_proibidas: z.array(z.string()).default([]),     // NÃO podem ser chamadas
  decisao_esperada: z.string().optional(),
})

// --- behavior --------------------------------------------------------------
const BehaviorCase = z.object({
  id: z.string(),
  entrada: z.string(),
  decisao_esperada: z.string().optional(),
  resultado_esperado: z.string().optional(),
  // termos que a resposta final deve / não deve conter (checagem objetiva)
  deve_conter: z.array(z.string()).default([]),
  nao_deve_conter: z.array(z.string()).default([]),
})

export const DatasetSchema = z.discriminatedUnion('tipo', [
  z.object({ tipo: z.literal('memory_impact'), casos: z.array(MemoryCase).min(1) }),
  z.object({ tipo: z.literal('tool_selection'), casos: z.array(ToolCase).min(1) }),
  z.object({ tipo: z.literal('behavior'), casos: z.array(BehaviorCase).min(1) }),
])

export type Dataset = z.infer<typeof DatasetSchema>
export type MemoryCaseT = z.infer<typeof MemoryCase>
export type ToolCaseT = z.infer<typeof ToolCase>
export type BehaviorCaseT = z.infer<typeof BehaviorCase>
