import Fastify from 'fastify'
import cors from '@fastify/cors'
import { HumanMessage } from '@langchain/core/messages'
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
  const trace = startTrace('react-agent', ['react', 'prod', scopeId])

  const result = await agent.invoke(
    {
      question,
      // scopeId genérico: chat manda userId; automação manda tenant/job; default global.
      scopeId,
      runId: `run-${Date.now()}`,
      messages: [new HumanMessage(question)],
    },
    { callbacks: trace.callbacks as never },
  )

  await flushTraces() // garante o envio antes de responder
  return { answer: result.finalAnswer ?? '', blocked: result.isBlocked ?? false }
})

await app.listen({ port: config.port, host: config.server.host })
logger.info(`react-agent ouvindo em :${config.port}`)
