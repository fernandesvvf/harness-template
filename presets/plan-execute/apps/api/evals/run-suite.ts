// Entrypoint de SUITE do preset plan-execute — gate de qualidade (exit != 0 se violar).
//
// Roda: npm run eval:suite -- <caminho-da-suite.yaml>
import { resolve } from 'node:path'
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
  return { fatos: section('Fatos conhecidos'), episodios: section('Execuções anteriores'), licoes: [] }
}

const invoke: InvokeForDataset = async (entrada) => {
  const r = await agent.invoke({ question: entrada, scopeId, runId: `s-${Date.now()}` })
  const subResults = (r.subResults ?? []) as { tool: string }[]
  const obs: Observed = {
    memoriaRecuperada: parseMemoria(r.memoryContext),
    toolsChamadas: subResults.map((s) => s.tool),
    output: r.finalAnswer ?? '',
  }
  return { obs }
}

const suitePath = process.argv[2]
if (!suitePath) {
  console.error('uso: npm run eval:suite -- <caminho-da-suite.yaml>')
  process.exit(1)
}
const result = await runSuite(resolve(suitePath), invoke)
process.exit(result.aprovado ? 0 : 1)
