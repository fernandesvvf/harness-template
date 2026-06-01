// Entrypoint do MEMORY-IMPACT eval do preset plan-execute (com vs sem memória).
// etapas = nº de steps executados (subResults). Sem lições (memória enxuta).
//
// Roda: npm run eval:memory -- <suite.yaml>
import { resolve } from 'node:path'
import { runMemoryEval, type InvokeMemoryEval, type MemoryRun } from '@harness/harness'

const scopeId = process.env.EVAL_SCOPE_ID ?? 'eval-memory'

function parseMemoria(ctx: string | undefined): string[] {
  if (!ctx) return []
  return ctx.split('\n').map((l) => l.replace(/^[-\s]+/, '').trim()).filter((l) => l && !l.endsWith(':'))
}

const invoke: InvokeMemoryEval = async (entrada, semMemoria) => {
  if (semMemoria) process.env.MEMORY_DISABLED = '1'
  else delete process.env.MEMORY_DISABLED
  const { buildAgent } = await import('../src/agent/factory.js')
  const agent = buildAgent()

  const r = await agent.invoke({ question: entrada, scopeId, runId: `m-${Date.now()}` })
  const subResults = (r.subResults ?? []) as { tool: string; result: unknown }[]
  const decisao = JSON.stringify(r.plan ?? []) + ' ' + (r.finalAnswer ?? '')

  const run: MemoryRun = {
    recuperados: parseMemoria(r.memoryContext),
    decisao,
    etapas: subResults.length, // nº de steps do plano executados
    licoes: [], // plan-execute não extrai lições
  }
  return run
}

const suite = process.argv[2]
if (!suite) {
  console.error('uso: npm run eval:memory -- <suite.yaml>')
  process.exit(1)
}
const result = await runMemoryEval(resolve(suite), invoke)
process.exit(result.aprovado ? 0 : 1)
