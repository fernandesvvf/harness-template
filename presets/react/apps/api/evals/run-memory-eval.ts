// Entrypoint do MEMORY-IMPACT eval do preset react.
// Roda cada caso 2x: SEM memória (MEMORY_DISABLED=1) e COM. Mede o ganho.
//
// Roda: npm run eval:memory -- <suite.yaml>
//   ex: npm run eval:memory -- ../../../../packages/harness/evals/suites/memory_impact_eval.yaml
import { resolve } from 'node:path'
import { HumanMessage, AIMessage } from '@langchain/core/messages'
import type { BaseMessage } from '@langchain/core/messages'
import { runMemoryEval, type InvokeMemoryEval, type MemoryRun } from '@harness/harness'
import { EpisodicMemoryService } from '@harness/memory'

const scopeId = process.env.EVAL_SCOPE_ID ?? 'eval-memory'

function parseMemoria(ctx: string | undefined): string[] {
  if (!ctx) return []
  return ctx
    .split('\n')
    .map((l) => l.replace(/^[-\s]+/, '').trim())
    .filter((l) => l && !l.endsWith(':')) // tira os cabeçalhos de seção
}

const invoke: InvokeMemoryEval = async (entrada, semMemoria) => {
  // O factory lê MEMORY_DISABLED no buildAgent — set por modo, importado dinâmico.
  if (semMemoria) process.env.MEMORY_DISABLED = '1'
  else delete process.env.MEMORY_DISABLED
  const { buildAgent } = await import('../src/agent/factory.js')
  const agent = buildAgent()

  const r = await agent.invoke({ question: entrada, scopeId, runId: `m-${Date.now()}`, messages: [new HumanMessage(entrada)] })
  const msgs = (r.messages ?? []) as BaseMessage[]
  const decisao = msgs
    .filter((m) => m instanceof AIMessage)
    .map((m) => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content)))
    .join(' ') + ' ' + (r.finalAnswer ?? '')

  // lições vivas no escopo (p/ lesson_quality)
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
    etapas: r.stepCount ?? 0,
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
