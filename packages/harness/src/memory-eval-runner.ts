// memory-eval-runner — roda o memory-impact eval (com vs sem memória) e aplica thresholds.
// O preset injeta como rodar 1 caso em cada modo (InvokeMemoryEval).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { parse as parseYaml } from 'yaml'
import { z } from 'zod'
import { DatasetSchema, type MemoryCaseT } from './dataset.schema.js'
import { scoreMemoryImpact, type MemoryRun } from './memory-eval.js'

// Suite específica do memory-impact (tem comparativo + thresholds).
const MemorySuiteSchema = z.object({
  dataset: z.string(),
  thresholds: z.record(z.number()).default({}),
})

/** O preset roda 1 caso no modo pedido e devolve a evidência. */
export type InvokeMemoryEval = (entrada: string, semMemoria: boolean) => Promise<MemoryRun>

export interface MemoryEvalResult {
  metricas: Record<string, number>
  status: Record<string, 'PASS' | 'FAIL' | 'N/A'>
  aprovado: boolean
  porCaso: { id: string; metricas: Record<string, number> }[]
}

// hallucination: menor é melhor (threshold é teto). As demais: maior é melhor (piso).
const MENOR_MELHOR = new Set(['hallucination_from_memory'])

export async function runMemoryEval(suitePath: string, invoke: InvokeMemoryEval): Promise<MemoryEvalResult> {
  const suite = MemorySuiteSchema.parse(parseYaml(readFileSync(suitePath, 'utf8')))
  const datasetPath = resolve(dirname(suitePath), '../datasets', suite.dataset)
  const ds = DatasetSchema.parse(JSON.parse(readFileSync(datasetPath, 'utf8')))
  if (ds.tipo !== 'memory_impact') throw new Error('memory-eval requer dataset tipo memory_impact')

  const porCaso: { id: string; metricas: Record<string, number> }[] = []
  for (const caso of ds.casos as MemoryCaseT[]) {
    console.log(`\n--- ${caso.id} ---`)
    const semMemoria = await invoke(caso.entrada, true) // baseline
    const comMemoria = await invoke(caso.entrada, false)
    const metricas = scoreMemoryImpact(caso, comMemoria, semMemoria)
    console.log(`  ${Object.entries(metricas).map(([k, v]) => `${k}=${v}`).join(' ')} (etapas sem=${semMemoria.etapas} com=${comMemoria.etapas})`)
    porCaso.push({ id: caso.id, metricas })
  }

  // Agrega (média por métrica).
  const nomes = Object.keys(porCaso[0]?.metricas ?? {})
  const metricas: Record<string, number> = {}
  for (const nome of nomes) {
    const vals = porCaso.map((c) => c.metricas[nome]!).filter((v) => v !== undefined)
    metricas[nome] = Math.round((vals.reduce((a, b) => a + b, 0) / Math.max(vals.length, 1)) * 1000) / 1000
  }

  // PASS/FAIL contra thresholds.
  const status: Record<string, 'PASS' | 'FAIL' | 'N/A'> = {}
  for (const [nome, valor] of Object.entries(metricas)) {
    const thr = suite.thresholds[nome]
    if (thr === undefined) { status[nome] = 'N/A'; continue }
    const ok = MENOR_MELHOR.has(nome) ? valor <= thr : valor >= thr
    status[nome] = ok ? 'PASS' : 'FAIL'
  }
  const aprovado = !Object.values(status).includes('FAIL')

  // Report markdown.
  const md: string[] = ['# Relatório de Impacto de Memória', '']
  md.push('| Métrica | Valor | Threshold | Status |', '|---|---|---|---|')
  for (const nome of nomes) {
    md.push(`| ${nome} | ${metricas[nome]} | ${suite.thresholds[nome] ?? '—'} | ${status[nome]} |`)
  }
  md.push('', '## Comparativo sem vs com memória (decision_improvement)', '')
  md.push('| Caso | improvement |', '|---|---|')
  for (const c of porCaso) md.push(`| ${c.id} | ${c.metricas.decision_improvement} |`)
  const dir = resolve(dirname(suitePath), '../resultados')
  mkdirSync(dir, { recursive: true })
  writeFileSync(resolve(dir, 'memory_impact_report.md'), md.join('\n'))

  console.log(`\n=== MEMORY IMPACT ===`)
  for (const nome of nomes) console.log(`  ${nome}=${metricas[nome]} [${status[nome]}]`)
  console.log(`  ${aprovado ? 'APROVADO ✓' : 'REPROVADO ✗'}`)

  return { metricas, status, aprovado, porCaso }
}
