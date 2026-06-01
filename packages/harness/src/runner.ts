// runner — Peça 3 do harness. Genérico: nunca muda por projeto.
//
// Fluxo (por case, repetido `runs` vezes pra média):
//   1. valida o contrato YAML (Schema-First)
//   2. roda o agente com callback Langfuse (observabilidade)
//   3. normaliza a execução em RunResult
//   4. pontua com evaluate() (puro) + judges (LLM)
//   5. envia scores pro Langfuse
//
// O agente NÃO é importado aqui — é injetado via InvokeAgent. Assim o mesmo
// runner serve react, plan-execute e reflection (P1 SoC + P2 DI).
import { readFileSync } from 'node:fs'
import { parse as parseYaml } from 'yaml'
import type { CaseResult, Score } from '@harness/types'
import { ContractSchema, type Contract, type Case } from './contract.schema.js'
import { evaluate, type RunResult } from './evaluate.js'
import { runJudge } from './judges.js'
import { startTrace, pushScores, flushTraces } from './tracer.js'

/**
 * Cada preset implementa isto: recebe o input do case + callbacks Langfuse,
 * roda seu grafo e devolve a execução normalizada + o traceId.
 */
export type InvokeAgent = (
  input: string,
  callbacks: unknown[],
) => Promise<{ run: RunResult; traceId?: string }>

export function loadContract(path: string): Contract {
  const raw = parseYaml(readFileSync(path, 'utf8'))
  return ContractSchema.parse(raw) // lança se o YAML for inválido
}

/** Média de scores de múltiplas runs do mesmo case (agente é não-determinístico). */
function averageScores(runs: Score[][]): Score[] {
  const acc = new Map<string, number[]>()
  for (const scores of runs) {
    for (const s of scores) {
      acc.set(s.name, [...(acc.get(s.name) ?? []), s.value])
    }
  }
  return [...acc.entries()].map(([name, values]) => ({
    name,
    value: values.reduce((a, b) => a + b, 0) / values.length,
  }))
}

async function runCase(
  contract: Contract,
  c: Case,
  invokeAgent: InvokeAgent,
): Promise<CaseResult> {
  const perRun: Score[][] = []
  let lastTraceId: string | undefined

  for (let i = 0; i < contract.runs; i++) {
    const trace = startTrace(contract.name, [contract.name, c.id, c.variation ?? 'unspecified'])
    const { run } = await invokeAgent(c.input, trace.callbacks)
    lastTraceId = (trace.handler as { getTraceId?: () => string } | null)?.getTraceId?.()
    const scores = await evaluate(c.assertions, run, runJudge)
    await pushScores(trace, scores)
    perRun.push(scores)
  }

  const scores = contract.runs > 1 ? averageScores(perRun) : perRun[0] ?? []
  return { caseId: c.id, traceId: lastTraceId, scores }
}

export async function runContract(
  contractPath: string,
  invokeAgent: InvokeAgent,
): Promise<CaseResult[]> {
  const contract = loadContract(contractPath)
  const results: CaseResult[] = []

  for (const c of contract.cases) {
    const result = await runCase(contract, c, invokeAgent)
    const summary = result.scores.map((s) => `${s.name}=${s.value.toFixed(2)}`).join(' ')
    console.log(`[${c.id}] ${summary}`)
    results.push(result)
  }

  await flushTraces()
  return results
}
