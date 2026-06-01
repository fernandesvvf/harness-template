// Entrypoint do MEMORY-IMPACT eval do preset reflection (com vs sem memória).
// etapas = iterações do critic loop. Lições via EpisodicMemoryService.
//
// Roda: npm run eval:memory -- <suite.yaml>
import { resolve } from 'node:path'
import { runMemoryEval, type InvokeMemoryEval, type MemoryRun } from '@harness/harness'
import { EpisodicMemoryService } from '@harness/memory'

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
  const decisao = (r.draft ?? '') + ' ' + (r.finalAnswer ?? '')

  let licoes: string[] = []
  if (!semMemoria) {
    try {
      const ep = new EpisodicMemoryService(30)
      const txt = await ep.getLessonsForPrompt(scopeId)
      licoes = txt ? txt.split('\n').map((l) => l.replace(/^[-\s]+/, '').trim()).filter(Boolean) : []
    } catch { /* memória pode estar off */ }
  }

  const run: MemoryRun = {
    recuperados: parseMemoria(r.memoryContext),
    decisao,
    etapas: r.iterations ?? 0, // iterações do critic loop
    licoes,
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
