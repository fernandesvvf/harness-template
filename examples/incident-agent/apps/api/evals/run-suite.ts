// Entrypoint de SUITE do preset react — roda o gate de qualidade.
// Reusa o mesmo InvokeForDataset (Observed) do run-datasets.
// Sai com código != 0 se algum limiar for violado (gate de CI).
//
// Roda: npm run eval:suite -- <caminho-da-suite.yaml>
import { resolve } from 'node:path'
import { HumanMessage, AIMessage } from '@langchain/core/messages'
import type { BaseMessage } from '@langchain/core/messages'
import { runSuite, type InvokeForDataset, type Observed } from '@harness/harness'
import { buildAgent } from '../src/agent/factory.js'

const agent = buildAgent()
const scopeId = process.env.EVAL_SCOPE_ID ?? 'eval-suite'

function parseMemoria(ctx: string | undefined): Observed['memoriaRecuperada'] {
  const empty = { fatos: [] as string[], episodios: [] as string[], licoes: [] as string[] }
  if (!ctx) return empty
  const section = (header: string): string[] => {
    const m = ctx.match(new RegExp(`${header}:\\n([\\s\\S]*?)(\\n\\n|$)`))
    return m ? m[1]!.split('\n').map((l) => l.replace(/^[-\s]+/, '').trim()).filter(Boolean) : []
  }
  return {
    fatos: section('Fatos conhecidos'),
    episodios: section('Execuções anteriores'),
    licoes: section('Lições aprendidas \\(evite repetir erros\\)'),
  }
}

const invoke: InvokeForDataset = async (entrada) => {
  const r = await agent.invoke(
    { question: entrada, scopeId, runId: `s-${Date.now()}`, messages: [new HumanMessage(entrada)] },
  )
  const msgs = (r.messages ?? []) as BaseMessage[]
  const tools = msgs.filter((m): m is AIMessage => m instanceof AIMessage).flatMap((m) => (m.tool_calls ?? []).map((tc) => tc.name))
  const obs: Observed = { memoriaRecuperada: parseMemoria(r.memoryContext), toolsChamadas: tools, output: r.finalAnswer ?? '' }
  return { obs }
}

const suitePath = process.argv[2]
if (!suitePath) {
  console.error('uso: npm run eval:suite -- <caminho-da-suite.yaml>')
  process.exit(1)
}

const result = await runSuite(resolve(suitePath), invoke)
// Gate: viola limiar → falha (exit != 0), serve de barreira em CI/pre-push.
process.exit(result.aprovado ? 0 : 1)
