// Entrypoint de eval orientada a DATASET do preset react.
// Liga o dataset-runner ao grafo, expondo o que o agente observou (Observed).
//
// Roda: npm run eval:datasets -- <caminho-do-dataset.json>
//   ex: npm run eval:datasets -- ../../../../packages/harness/evals/datasets/tool_selection_cases.json
import { resolve } from 'node:path'
import { HumanMessage, AIMessage } from '@langchain/core/messages'
import type { BaseMessage } from '@langchain/core/messages'
import { runDataset, type InvokeForDataset, type Observed } from '@harness/harness'
import { buildAgent } from '../src/agent/factory.js'

const agent = buildAgent()
const scopeId = process.env.EVAL_SCOPE_ID ?? 'eval-dataset'

// Extrai as seções do memoryContext (montado pelo recall.node) por tipo.
function parseMemoria(ctx: string | undefined): Observed['memoriaRecuperada'] {
  const empty = { fatos: [] as string[], episodios: [] as string[], licoes: [] as string[] }
  if (!ctx) return empty
  const section = (header: string): string[] => {
    const re = new RegExp(`${header}:\\n([\\s\\S]*?)(\\n\\n|$)`)
    const m = ctx.match(re)
    if (!m) return []
    return m[1]!.split('\n').map((l) => l.replace(/^[-\s]+/, '').trim()).filter(Boolean)
  }
  return {
    fatos: section('Fatos conhecidos'),
    episodios: section('Execuções anteriores'),
    licoes: section('Lições aprendidas \\(evite repetir erros\\)'),
  }
}

const invoke: InvokeForDataset = async (entrada, callbacks) => {
  const result = await agent.invoke(
    { question: entrada, scopeId, runId: `ds-${Date.now()}`, messages: [new HumanMessage(entrada)] },
    { callbacks: callbacks as never },
  )
  const messages = (result.messages ?? []) as BaseMessage[]
  const toolsChamadas = messages
    .filter((m): m is AIMessage => m instanceof AIMessage)
    .flatMap((m) => (m.tool_calls ?? []).map((tc) => tc.name))

  const obs: Observed = {
    memoriaRecuperada: parseMemoria(result.memoryContext),
    toolsChamadas,
    output: result.finalAnswer ?? '',
  }
  return { obs }
}

const path = process.argv[2]
if (!path) {
  console.error('uso: npm run eval:datasets -- <caminho-do-dataset.json>')
  process.exit(1)
}
await runDataset(resolve(path), invoke)
