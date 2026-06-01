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

// Handlers criados nesta execução — precisam de flush próprio (buffer separado).
const handlers: CallbackHandler[] = []

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
  handlers.push(handler) // registrado pra flush no fim (buffer próprio)
  return { callbacks: [handler], handler }
}

/**
 * Envia os scores ligados ao trace do case.
 * IMPORTANTE: flusha o handler (persiste o trace) ANTES de pontuar — senão o score
 * chega antes do trace existir no backend e o Langfuse v2 retorna 500 (race).
 */
export async function pushScores(
  trace: TraceContext,
  scores: Score[],
): Promise<void> {
  if (!langfuse || !trace.handler) return
  const traceId = (trace.handler as { getTraceId?: () => string }).getTraceId?.()
  if (!traceId) return
  await trace.handler.flushAsync() // garante o trace persistido antes do score
  for (const s of scores) {
    langfuse.score({ traceId, name: s.name, value: s.value })
  }
  await langfuse.flushAsync()
}

/** Flush de tudo: cada handler (traces) + o cliente global (scores). */
export async function flushTraces(): Promise<void> {
  await Promise.all(handlers.map((h) => h.flushAsync()))
  if (langfuse) await langfuse.flushAsync()
  handlers.length = 0
}
