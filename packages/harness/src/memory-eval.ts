// memory-eval — mede o IMPACTO da memória (não só o que recuperou).
// Inspirado no memory_eval.py (aula15): roda cada caso COM e SEM memória e compara.
//
// Métricas (todas puras, 0..1):
//   retrieval_precision  — dos recuperados, quantos eram esperados
//   retrieval_recall     — dos esperados, quantos foram recuperados
//   memory_utilization   — dos recuperados, quantos aparecem na decisão/resposta
//   hallucination_from_memory — tokens da resposta que não vêm da entrada nem da memória
//   decision_improvement — redução de etapas COM memória vs SEM (prova o cenário BOA)
//   lesson_quality       — % de lições não-vazias e generalizáveis
import type { MemoryCaseT } from './dataset.schema.js'

/** Evidência de uma execução, normalizada pelo preset. */
export interface MemoryRun {
  /** itens de memória recuperados (textos) */
  recuperados: string[]
  /** texto da decisão/raciocínio/resposta (onde a memória deveria aparecer se usada) */
  decisao: string
  /** nº de etapas da execução (loop steps / plan steps) */
  etapas: number
  /** lições vivas no escopo (texto) — p/ lesson_quality */
  licoes: string[]
}

const toks = (s: string, min = 3, max = 3): string[] =>
  s.toLowerCase().split(/\s+/).filter((t) => t.length > min).slice(0, max)

function esperadosUnificados(caso: MemoryCaseT): string[] {
  const c = caso.contexto_esperado
  return [...c.fatos_relevantes, ...c.episodios_relevantes, ...c.licoes_relevantes].filter(Boolean)
}

export function precision(recuperados: string[], esperados: string[]): number {
  if (recuperados.length === 0) return 1
  if (esperados.length === 0) return 0
  let rel = 0
  for (const r of recuperados) {
    const rl = r.toLowerCase()
    if (esperados.some((e) => toks(e).some((t) => rl.includes(t)))) rel++
  }
  return rel / recuperados.length
}

export function recall(recuperados: string[], esperados: string[]): number {
  if (esperados.length === 0) return 1
  if (recuperados.length === 0) return 0
  const rl = recuperados.map((r) => r.toLowerCase())
  let found = 0
  for (const e of esperados) {
    if (toks(e).some((t) => rl.some((r) => r.includes(t)))) found++
  }
  return found / esperados.length
}

/** Dos recuperados, quantos aparecem na decisão (foram de fato usados). */
export function utilization(recuperados: string[], decisao: string): number {
  if (recuperados.length === 0) return 1
  const d = decisao.toLowerCase()
  if (!d) return 0
  let used = 0
  for (const r of recuperados) {
    if (toks(r, 4).some((t) => d.includes(t))) used++
  }
  return used / recuperados.length
}

/** Tokens da decisão que não vêm da entrada nem da memória (alucinação). Menor = melhor. */
export function hallucination(recuperados: string[], entrada: string, decisao: string): number {
  const chaves = decisao
    .split(/\s+/)
    .map((t) => t.toLowerCase().replace(/[.,;:"'()[\]{}]/g, ''))
    .filter((t) => t.length > 4)
    .slice(0, 10)
  if (chaves.length === 0) return 0
  const disponivel = (entrada + ' ' + recuperados.join(' ')).toLowerCase()
  const novas = chaves.filter((c) => c && !disponivel.includes(c)).length
  return novas / chaves.length
}

/** Redução de etapas COM memória vs SEM. Positivo = memória ajudou (cenário BOA). */
export function decisionImprovement(etapasSem: number, etapasCom: number): number {
  if (etapasSem === 0) return 0
  return (etapasSem - etapasCom) / etapasSem
}

/** % de lições não-vazias e generalizáveis (sem dígitos/IDs específicos). */
export function lessonQuality(licoes: string[]): number {
  if (licoes.length === 0) return 0
  const boas = licoes.filter((l) => {
    const t = l.trim()
    if (t.length < 10) return false
    // generalizável: heurística — não cita ID/versão específica (ex: "v2.3.1", "ep_001")
    return !/\b(v?\d+\.\d+|ep_\d+|lic_\d+|#\d+)\b/i.test(t)
  }).length
  return boas / licoes.length
}

/** Calcula todas as métricas de um caso (com run COM e SEM memória). */
export function scoreMemoryImpact(
  caso: MemoryCaseT,
  comMemoria: MemoryRun,
  semMemoria: MemoryRun,
): Record<string, number> {
  const esperados = esperadosUnificados(caso)
  return {
    retrieval_precision: round(precision(comMemoria.recuperados, esperados)),
    retrieval_recall: round(recall(comMemoria.recuperados, esperados)),
    memory_utilization: round(utilization(comMemoria.recuperados, comMemoria.decisao)),
    hallucination_from_memory: round(hallucination(comMemoria.recuperados, caso.entrada, comMemoria.decisao)),
    decision_improvement: round(decisionImprovement(semMemoria.etapas, comMemoria.etapas)),
    lesson_quality: round(lessonQuality(comMemoria.licoes)),
  }
}

const round = (n: number): number => Math.round(n * 1000) / 1000
