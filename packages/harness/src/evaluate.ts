// evaluate — funções PURAS de scoring (P15 Harness-Verified Behavior).
// Sem I/O, sem LLM, sem Langfuse. Testáveis com expect() igual edge-conditions.
//
// O runner colhe o resultado da execução do grafo num RunResult normalizado
// e passa pra cá. Assim o scoring não depende de onde o trace veio.
import type { Score } from '@harness/types'
import type { CaseAssertions } from './contract.schema.js'

/** O que o runner extrai de uma execução, normalizado por arquitetura. */
export interface RunResult {
  /** tool calls observadas, em ordem */
  toolCalls: { name: string; params: Record<string, unknown> }[]
  /** texto de raciocínio concatenado (reasoning de cada step LLM) */
  reasoningText: string
  /** resposta final em texto */
  output: string
}

/** Resultado de um judge LLM (injetado pelo runner; mantém evaluate puro). */
export type JudgeFn = (judgeName: string, text: string) => Promise<number>

/** Checa params de uma tool contra as regras do contrato. Pura. */
export function checkParams(
  actual: Record<string, unknown>,
  expected: Record<string, string>,
): number {
  const keys = Object.keys(expected)
  if (keys.length === 0) return 1.0

  let hits = 0
  for (const key of keys) {
    if (!(key in actual)) continue
    const rule = expected[key]!
    const actualStr = String(actual[key] ?? '').toLowerCase()
    if (rule.startsWith('contains:')) {
      if (actualStr.includes(rule.slice('contains:'.length).toLowerCase())) hits += 1
    } else if (actualStr === rule.toLowerCase()) {
      hits += 1
    }
  }
  return hits / keys.length
}

/** Scoring determinístico (tudo menos os judges LLM). Puro. */
export function evaluateDeterministic(
  assertions: CaseAssertions,
  run: RunResult,
): Score[] {
  const scores: Score[] = []
  const toolNames = run.toolCalls.map((t) => t.name)

  for (const expected of assertions.tool_calls ?? []) {
    const called = toolNames.includes(expected.tool)
    if (expected.expect_called === false) {
      scores.push({ name: `no_${expected.tool}`, value: Number(!called) })
      continue
    }
    scores.push({ name: `called_${expected.tool}`, value: Number(called) })
    if (called && expected.params) {
      const actual = run.toolCalls.find((t) => t.name === expected.tool)!
      scores.push({
        name: `params_${expected.tool}`,
        value: checkParams(actual.params, expected.params),
      })
    }
  }

  if (assertions.tool_count) {
    scores.push({
      name: 'tool_count_ok',
      value: Number(run.toolCalls.length <= assertions.tool_count.max),
    })
  }

  if (assertions.output?.contains) {
    const lower = run.output.toLowerCase()
    for (const word of assertions.output.contains) {
      scores.push({ name: `output_contains_${word}`, value: Number(lower.includes(word.toLowerCase())) })
    }
  }

  return scores
}

/** Scoring completo: determinístico + judges LLM (async via injeção). */
export async function evaluate(
  assertions: CaseAssertions,
  run: RunResult,
  runJudge: JudgeFn,
): Promise<Score[]> {
  const scores = evaluateDeterministic(assertions, run)

  if (assertions.reasoning) {
    scores.push({
      name: 'reasoning_quality',
      value: await runJudge(assertions.reasoning.judge, run.reasoningText),
    })
  }

  if (assertions.output?.judge) {
    scores.push({
      name: 'output_quality',
      value: await runJudge(assertions.output.judge, run.output),
    })
  }

  return scores
}
