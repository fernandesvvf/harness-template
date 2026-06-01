// contract.schema — Schema-First aplicado ao PRÓPRIO contrato de eval.
// Um YAML malformado falha aqui, antes do runner rodar qualquer agente.
//
// Estrutura espelha o material da aula (Peça 2 — Contratos YAML):
//   1 YAML = 1 capability ; 1 case = 1 variação.
import { z } from 'zod'

/** Regra de parâmetro: "contains:foo" (substring) ou igualdade exata. */
const ParamRule = z.string()

const ToolAssertion = z.object({
  tool: z.string(),
  /** se true, a tool DEVE ter sido chamada */
  required: z.boolean().optional(),
  /** se false, a tool NÃO pode ter sido chamada (ex: não comprar sem pedir) */
  expect_called: z.boolean().optional(),
  params: z.record(ParamRule).optional(),
})

const JudgeAssertion = z.object({
  judge: z.string(),
  min_score: z.number().min(0).max(1),
})

const OutputAssertion = z.object({
  contains: z.array(z.string()).optional(),
  judge: z.string().optional(),
  min_score: z.number().min(0).max(1).optional(),
})

const Assertions = z.object({
  tool_calls: z.array(ToolAssertion).optional(),
  tool_count: z.object({ max: z.number().int().positive() }).optional(),
  reasoning: JudgeAssertion.optional(),
  output: OutputAssertion.optional(),
})

export const CaseSchema = z.object({
  id: z.string(),
  /** variação coberta — força pensar nas 5 categorias */
  variation: z
    .enum(['happy_path', 'edge_case', 'adversarial', 'ambiguous', 'wrong_tool_temptation'])
    .optional(),
  input: z.string(),
  assertions: Assertions,
})

export const ContractSchema = z.object({
  name: z.string(),
  description: z.string(),
  /** quantas vezes rodar cada case (média — agente é não-determinístico) */
  runs: z.number().int().positive().default(1),
  cases: z.array(CaseSchema).min(1),
})

export type Contract = z.infer<typeof ContractSchema>
export type Case = z.infer<typeof CaseSchema>
export type CaseAssertions = z.infer<typeof Assertions>
