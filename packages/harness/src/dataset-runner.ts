// dataset-runner — roda um dataset JSON e pontua com scorers objetivos.
// Genérico: o preset injeta como rodar o agente e o que ele observou (Observed).
import { readFileSync } from 'node:fs'
import type { Score } from '@harness/types'
import { DatasetSchema, type Dataset } from './dataset.schema.js'
import { scoreMemory, scoreToolSelection, scoreBehavior, type Observed } from './scorers.js'
import { startTrace, pushScores, flushTraces } from './tracer.js'

/** O preset implementa: roda o agente com a entrada e devolve o que observou. */
export type InvokeForDataset = (entrada: string, callbacks: unknown[]) => Promise<{ obs: Observed; traceId?: string }>

export interface DatasetResult {
  caseId: string
  scores: Score[]
}

export function loadDataset(path: string): Dataset {
  return DatasetSchema.parse(JSON.parse(readFileSync(path, 'utf8')))
}

export async function runDataset(path: string, invoke: InvokeForDataset): Promise<DatasetResult[]> {
  const ds = loadDataset(path)
  const results: DatasetResult[] = []

  // Roda 1 caso: invoca o agente e aplica o scorer já escolhido pelo tipo.
  async function runOne(id: string, entrada: string, score: (obs: Observed) => Score[]): Promise<void> {
    const trace = startTrace(ds.tipo, [ds.tipo, id])
    const { obs, traceId } = await invoke(entrada, trace.callbacks)
    const scores = score(obs)
    await pushScores(traceId, scores)
    console.log(`[${ds.tipo}/${id}] ${scores.map((s) => `${s.name}=${s.value.toFixed(2)}`).join(' ')}`)
    results.push({ caseId: id, scores })
  }

  // O switch narrow garante o tipo certo de caso em cada scorer.
  if (ds.tipo === 'memory_impact') {
    for (const c of ds.casos) await runOne(c.id, c.entrada, (obs) => scoreMemory(c, obs))
  } else if (ds.tipo === 'tool_selection') {
    for (const c of ds.casos) await runOne(c.id, c.entrada, (obs) => scoreToolSelection(c, obs))
  } else {
    for (const c of ds.casos) await runOne(c.id, c.entrada, (obs) => scoreBehavior(c, obs))
  }

  await flushTraces()
  return results
}
