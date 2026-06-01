// Benchmark comparativo — roda o MESMO dataset nos 3 presets e gera report.md.
// Fecha o P14 (Seleção de Arquitetura) com dados reais: tokens, tempo, cobertura.
//
// Pré-requisitos: OPENROUTER_API_KEY no ambiente. (Memória off por padrão nos presets,
// então Postgres não é obrigatório p/ o benchmark base.)
//
// Roda: tsx --env-file=.env scripts/benchmark.ts [dataset.json]
import { resolve } from 'node:path'
import { HumanMessage, AIMessage } from '@langchain/core/messages'
import type { BaseMessage } from '@langchain/core/messages'
import { runBenchmark, gerarReport, type InvokeForBenchmark, type BenchmarkResult } from '@harness/harness'
import type { Observed } from '@harness/harness'
import { buildAgent as buildReact } from '../presets/react/apps/api/src/agent/factory.js'
import { buildAgent as buildPlan } from '../presets/plan-execute/apps/api/src/agent/factory.js'
import { buildAgent as buildReflection } from '../presets/reflection/apps/api/src/agent/factory.js'

const EMPTY: Observed = { memoriaRecuperada: { fatos: [], episodios: [], licoes: [] }, toolsChamadas: [], output: '' }

// Adaptadores: cada preset normaliza a execução no Observed do benchmark.
const reactInvoke: InvokeForBenchmark = async (entrada) => {
  const agent = buildReact()
  const r = await agent.invoke({ question: entrada, scopeId: 'bench-react', runId: `b-${Date.now()}`, messages: [new HumanMessage(entrada)] })
  const msgs = (r.messages ?? []) as BaseMessage[]
  const tools = msgs.filter((m): m is AIMessage => m instanceof AIMessage).flatMap((m) => (m.tool_calls ?? []).map((tc) => tc.name))
  return { obs: { ...EMPTY, toolsChamadas: tools, output: r.finalAnswer ?? '' }, concluido: Boolean(r.finalAnswer) && !r.isBlocked }
}

const planInvoke: InvokeForBenchmark = async (entrada) => {
  const agent = buildPlan()
  const r = await agent.invoke({ question: entrada, scopeId: 'bench-plan', runId: `b-${Date.now()}` })
  const tools = ((r.subResults ?? []) as { tool: string }[]).map((s) => s.tool)
  return { obs: { ...EMPTY, toolsChamadas: tools, output: r.finalAnswer ?? '' }, concluido: Boolean(r.finalAnswer) && !r.isBlocked }
}

const reflectionInvoke: InvokeForBenchmark = async (entrada) => {
  const agent = buildReflection()
  const r = await agent.invoke({ question: entrada, scopeId: 'bench-reflection', runId: `b-${Date.now()}` })
  return { obs: { ...EMPTY, output: r.finalAnswer ?? r.draft ?? '' }, concluido: Boolean(r.finalAnswer ?? r.draft) && !r.isBlocked }
}

const dataset = process.argv[2]
  ? resolve(process.argv[2])
  : resolve(import.meta.dirname, '../packages/harness/evals/datasets/behavior_cases.json')

const arquiteturas: [string, InvokeForBenchmark][] = [
  ['react', reactInvoke],
  ['plan-execute', planInvoke],
  ['reflection', reflectionInvoke],
]

const resultados: BenchmarkResult[] = []
for (const [nome, invoke] of arquiteturas) {
  console.log(`\n=== ${nome} ===`)
  resultados.push(await runBenchmark(nome, dataset, invoke))
}

gerarReport(resultados, resolve(import.meta.dirname, '../benchmarks/report.md'))
