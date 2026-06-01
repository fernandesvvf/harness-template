// scorers — funções PURAS de scoring objetivo p/ datasets (P6, P15).
// Comparam o que o agente observou contra o ground-truth do caso.
// Sem I/O, sem LLM — testáveis com expect().
import type { Score } from '@harness/types'
import type { MemoryCaseT, ToolCaseT, BehaviorCaseT } from './dataset.schema.js'

/** O que o agente realmente fez numa execução, normalizado pelo preset. */
export interface Observed {
  /** itens de memória recuperados (textos de fatos/episódios/lições) */
  memoriaRecuperada: { fatos: string[]; episodios: string[]; licoes: string[] }
  /** tools chamadas, em ordem */
  toolsChamadas: string[]
  /** resposta final */
  output: string
}

/** Recall: quantos dos esperados apareceram no recuperado (match por substring). */
function recall(expected: string[], got: string[]): number {
  if (expected.length === 0) return 1 // nada esperado = trivialmente ok
  const hay = got.map((g) => g.toLowerCase())
  const hits = expected.filter((e) => hay.some((g) => g.includes(e.toLowerCase()))).length
  return hits / expected.length
}

/** Precision: quanto do recuperado era esperado (penaliza ruído — cenário IRRELEVANTE). */
function precision(expected: string[], got: string[]): number {
  if (got.length === 0) return 1 // nada recuperado = sem ruído
  const exp = expected.map((e) => e.toLowerCase())
  const hits = got.filter((g) => exp.some((e) => g.toLowerCase().includes(e))).length
  return hits / got.length
}

// --- memory_impact ---------------------------------------------------------
export function scoreMemory(c: MemoryCaseT, obs: Observed): Score[] {
  const exp = c.contexto_esperado
  const scores: Score[] = [
    { name: 'recall_fatos', value: recall(exp.fatos_relevantes, obs.memoriaRecuperada.fatos) },
    { name: 'recall_episodios', value: recall(exp.episodios_relevantes, obs.memoriaRecuperada.episodios) },
    { name: 'recall_licoes', value: recall(exp.licoes_relevantes, obs.memoriaRecuperada.licoes) },
  ]
  // precisão agregada da memória (guarda IRRELEVANTE)
  const allExp = [...exp.fatos_relevantes, ...exp.episodios_relevantes, ...exp.licoes_relevantes]
  const allGot = [...obs.memoriaRecuperada.fatos, ...obs.memoriaRecuperada.episodios, ...obs.memoriaRecuperada.licoes]
  scores.push({ name: 'precision_memoria', value: precision(allExp, allGot) })
  if (c.resultado_esperado) {
    scores.push({ name: 'resultado_ok', value: Number(obs.output.toLowerCase().includes(c.resultado_esperado.toLowerCase())) })
  }
  return scores
}

// --- tool_selection --------------------------------------------------------
export function scoreToolSelection(c: ToolCaseT, obs: Observed): Score[] {
  const called = new Set(obs.toolsChamadas)
  const scores: Score[] = []
  if (c.tools_esperadas.length) {
    const hits = c.tools_esperadas.filter((t) => called.has(t)).length
    scores.push({ name: 'tools_esperadas_ok', value: hits / c.tools_esperadas.length })
  }
  for (const t of c.tools_proibidas) {
    scores.push({ name: `nao_chamou_${t}`, value: Number(!called.has(t)) })
  }
  return scores
}

// --- behavior --------------------------------------------------------------
export function scoreBehavior(c: BehaviorCaseT, obs: Observed): Score[] {
  const lower = obs.output.toLowerCase()
  const scores: Score[] = []
  for (const w of c.deve_conter) scores.push({ name: `contem_${w}`, value: Number(lower.includes(w.toLowerCase())) })
  for (const w of c.nao_deve_conter) scores.push({ name: `nao_contem_${w}`, value: Number(!lower.includes(w.toLowerCase())) })
  if (c.resultado_esperado) {
    scores.push({ name: 'resultado_ok', value: Number(lower.includes(c.resultado_esperado.toLowerCase())) })
  }
  return scores
}
