// factory — único ponto de instanciação (P3 Factory + P2 DI).
import { resolve } from 'node:path'
import {
  loadMemoryContract,
  LongTermMemoryService,
  EpisodicMemoryService,
  ContextualMemoryService,
} from '@harness/memory'
import { OpenRouterService } from '../services/openrouter.service.js'
import { makeEmbedder } from '../services/embedder.service.js'
import { config } from '../config.js'
import { logger } from '../utils/logger.js'
import { buildAgentGraph } from './graph.js'

// Memória completa opt-in (reflection combina bem com reflexão evolutiva).
// MEMORY_DISABLED=1 desliga tudo (baseline do memory-impact eval).
function buildMemory() {
  if (process.env.MEMORY_DISABLED === '1') return { longTerm: null, episodic: null, contextual: null }
  let contract
  try {
    contract = loadMemoryContract(resolve(process.cwd(), 'memory.md'))
  } catch (err) {
    logger.warn({ err }, 'memory.md não carregado — memória persistida desabilitada')
    return { longTerm: null, episodic: null, contextual: null }
  }
  const longTerm = contract.memorias.longa.enabled ? new LongTermMemoryService() : null
  const ep = contract.memorias.episodica
  const episodic = ep.enabled ? new EpisodicMemoryService(ep.ttl_dias) : null
  const ctx = contract.memorias.contextual
  const contextual = ctx.enabled
    ? new ContextualMemoryService(makeEmbedder(), { limiar: ctx.limiar, maxFragmentos: ctx.max_fragmentos }, config.memory.embeddingDim)
    : null
  return { longTerm, episodic, contextual }
}

export function buildAgent() {
  const { longTerm, episodic, contextual } = buildMemory()
  const memoryEnabled = Boolean(longTerm || episodic || contextual)

  const deps = {
    guardrailsLlm: new OpenRouterService(config.models.guardrails),
    generatorLlm: new OpenRouterService(config.models.generator),
    // CRITIC_MODEL = GENERATOR_MODEL → self-reflection; modelo maior → cross-reflection.
    criticLlm: new OpenRouterService(config.models.critic),
    memoryLlm: memoryEnabled ? new OpenRouterService(config.models.memory) : null,
    longTerm,
    episodic,
    contextual,
  }
  return buildAgentGraph(deps)
}
