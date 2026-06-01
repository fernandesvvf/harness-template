import Fastify from 'fastify'
import cors from '@fastify/cors'
import { startTrace, flushTraces } from '@harness/harness'
import { config } from './config.js'
import { logger } from './utils/logger.js'
import { buildAgent } from './agent/factory.js'

const app = Fastify({ loggerInstance: logger })
await app.register(cors, { origin: true })

const agent = buildAgent()

app.get('/health', async () => ({ status: 'ok', version: config.server.version }))

app.post<{ Body: { question: string; scopeId?: string } }>('/chat', async (req, reply) => {
  const question = req.body?.question
  if (!question) return reply.code(400).send({ error: 'question é obrigatório' })

  const scopeId = req.body?.scopeId ?? 'global'
  // Observabilidade: traça toda run de produção no Langfuse (no-op se sem chaves).
  const trace = startTrace('reflection-agent', ['reflection', 'prod', scopeId])

  const result = await agent.invoke(
    { question, scopeId, runId: `run-${Date.now()}` },
    { callbacks: trace.callbacks as never },
  )

  await flushTraces()
  // fallback pro draft se o teto foi atingido sem aprovação
  return { answer: result.finalAnswer ?? result.draft ?? '', blocked: result.isBlocked ?? false }
})

await app.listen({ port: config.port, host: config.server.host })
logger.info(`reflection-agent ouvindo em :${config.port}`)
