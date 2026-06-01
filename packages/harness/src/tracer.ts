// tracer — integração Langfuse (Peça 1 do harness: observabilidade).
// O callback é plugado no graph.invoke sem mudar o agente.
import { Langfuse } from 'langfuse'
import { CallbackHandler } from 'langfuse-langchain'
import type { Score } from '@harness/types'

const enabled = Boolean(process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY)

const langfuse = enabled
  ? new Langfuse({
      publicKey: process.env.LANGFUSE_PUBLIC_KEY!,
      secretKey: process.env.LANGFUSE_SECRET_KEY!,
      baseUrl: process.env.LANGFUSE_HOST ?? 'http://localhost:3030',
    })
  : null

export interface TraceContext {
  /** callback pra passar em config.callbacks do graph.invoke; [] se desabilitado */
  callbacks: CallbackHandler[]
  handler: CallbackHandler | null
}

/** Cria um contexto de trace por case. Tags permitem comparar arquiteturas/modelos. */
export function startTrace(runName: string, tags: string[]): TraceContext {
  if (!enabled) return { callbacks: [], handler: null }
  const handler = new CallbackHandler({
    publicKey: process.env.LANGFUSE_PUBLIC_KEY!,
    secretKey: process.env.LANGFUSE_SECRET_KEY!,
    baseUrl: process.env.LANGFUSE_HOST ?? 'http://localhost:3030',
    sessionId: runName,
    tags,
  })
  return { callbacks: [handler], handler }
}

/** Envia os scores calculados pro Langfuse, ligados ao trace do case. */
export async function pushScores(traceId: string | undefined, scores: Score[]): Promise<void> {
  if (!langfuse || !traceId) return
  for (const s of scores) {
    langfuse.score({ traceId, name: s.name, value: s.value })
  }
}

export async function flushTraces(): Promise<void> {
  if (langfuse) await langfuse.flushAsync()
}
