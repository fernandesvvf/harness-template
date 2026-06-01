// Tipos do harness — espelham o contrato YAML de eval.
// A validação Zod real fica em packages/harness/src/contract.schema.ts.

export type CaseVariation =
  | 'happy_path'
  | 'edge_case'
  | 'adversarial'
  | 'ambiguous'
  | 'wrong_tool_temptation'

/** Score individual produzido pelo runner e enviado ao Langfuse. */
export interface Score {
  name: string
  value: number
}

export interface CaseResult {
  caseId: string
  traceId?: string
  scores: Score[]
}
