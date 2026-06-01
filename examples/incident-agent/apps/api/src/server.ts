import Fastify from 'fastify'
import cors from '@fastify/cors'
import { HumanMessage } from '@langchain/core/messages'
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

  const result = await agent.invoke({
    question,
    // scopeId genérico: chat manda userId; automação manda tenant/job; default global.
    scopeId: req.body?.scopeId ?? 'global',
    runId: `run-${Date.now()}`,
    messages: [new HumanMessage(question)],
  })

  return { answer: result.finalAnswer ?? '', blocked: result.isBlocked ?? false }
})

await app.listen({ port: config.port, host: config.server.host })
logger.info(`react-agent ouvindo em :${config.port}`)
