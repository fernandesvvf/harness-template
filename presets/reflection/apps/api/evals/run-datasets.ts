// Entrypoint de eval orientada a DATASET do preset reflection.
// reflection não usa tools (generator⇄critic) → toolsChamadas vazio.
// output = resposta aprovada (ou draft no teto). Memória completa.
//
// Roda: npm run eval:datasets -- <caminho-do-dataset.json>
import { resolve } from 'node:path'
import { runDataset, type InvokeForDataset, type Observed } from '@harness/harness'
import { buildAgent } from '../src/agent/factory.js'

const agent = buildAgent()
const scopeId = process.env.EVAL_SCOPE_ID ?? 'eval-dataset'

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

const invoke: InvokeForDataset = async (entrada, callbacks) => {
  const r = await agent.invoke(
    { question: entrada, scopeId, runId: `ds-${Date.now()}` },
    { callbacks: callbacks as never },
  )
  const obs: Observed = {
    memoriaRecuperada: parseMemoria(r.memoryContext),
    toolsChamadas: [], // reflection não usa tools
    output: r.finalAnswer ?? r.draft ?? '',
  }
  return { obs }
}

const path = process.argv[2]
if (!path) {
  console.error('uso: npm run eval:datasets -- <caminho-do-dataset.json>')
  process.exit(1)
}
await runDataset(resolve(path), invoke)
