// suite-runner — roda uma eval suite e aplica o GATE de limiares.
// Agrega os scores do dataset (média por métrica), compara com os limiares da suite,
// salva o resultado em resultados/ e sinaliza violações (gate de CI: exit != 0).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { parse as parseYaml } from 'yaml'
import type { Score } from '@harness/types'
import { SuiteSchema, type Suite } from './suite.schema.js'
import { loadDataset } from './dataset-runner.js'
import { scoreMemory, scoreToolSelection, scoreBehavior, type Observed } from './scorers.js'
import type { InvokeForDataset } from './dataset-runner.js'

export interface SuiteResult {
  suite: string
  metricas: Record<string, number> // média 0..1 por métrica
  violacoes: string[]
  aprovado: boolean
}

export function loadSuite(path: string): Suite {
  return SuiteSchema.parse(parseYaml(readFileSync(path, 'utf8')))
}

/** Média dos scores por nome, sobre todos os casos. */
function agregar(todos: Score[][]): Record<string, number> {
  const acc = new Map<string, number[]>()
  for (const scores of todos) {
    for (const s of scores) acc.set(s.name, [...(acc.get(s.name) ?? []), s.value])
  }
  const out: Record<string, number> = {}
  for (const [nome, vals] of acc) out[nome] = Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 1000) / 1000
  return out
}

/**
 * Roda a suite. invoke é injetado pelo preset (mesma assinatura do dataset-runner).
 * Salva resultado em resultados/<suite>.json. Retorna o resultado + se aprovou.
 */
export async function runSuite(suitePath: string, invoke: InvokeForDataset): Promise<SuiteResult> {
  const suite = loadSuite(suitePath)
  const datasetPath = resolve(dirname(suitePath), suite.dataset)
  const ds = loadDataset(datasetPath)

  const todos: Score[][] = []
  for (const c of ds.casos) {
    const { obs } = await invoke(c.entrada, [])
    const scores =
      ds.tipo === 'memory_impact'
        ? scoreMemory(c as Parameters<typeof scoreMemory>[0], obs as Observed)
        : ds.tipo === 'tool_selection'
          ? scoreToolSelection(c as Parameters<typeof scoreToolSelection>[0], obs as Observed)
          : scoreBehavior(c as Parameters<typeof scoreBehavior>[0], obs as Observed)
    todos.push(scores)
  }

  const metricas = agregar(todos)

  // GATE: checa cada limiar declarado na suite.
  const violacoes: string[] = []
  for (const [metrica, limiar] of Object.entries(suite.limiares)) {
    const valor = metricas[metrica]
    if (valor === undefined) {
      violacoes.push(`${metrica}: métrica ausente no resultado`)
      continue
    }
    if (limiar.min !== undefined && valor < limiar.min) violacoes.push(`${metrica}: ${valor} < min ${limiar.min}`)
    if (limiar.max !== undefined && valor > limiar.max) violacoes.push(`${metrica}: ${valor} > max ${limiar.max}`)
  }

  const result: SuiteResult = { suite: suite.nome, metricas, violacoes, aprovado: violacoes.length === 0 }

  // Persiste em resultados/ (ao lado da pasta suites/).
  const resultadosDir = resolve(dirname(suitePath), '../resultados')
  mkdirSync(resultadosDir, { recursive: true })
  writeFileSync(resolve(resultadosDir, `${suite.nome}.json`), JSON.stringify(result, null, 2))

  // Log + gate.
  console.log(`\n=== SUITE ${suite.nome} ===`)
  for (const [m, v] of Object.entries(metricas)) console.log(`  ${m} = ${v}`)
  if (violacoes.length) {
    console.log('  VIOLAÇÕES:')
    for (const v of violacoes) console.log(`    ✗ ${v}`)
  } else {
    console.log('  limiares: todos aprovados ✓')
  }
  return result
}
