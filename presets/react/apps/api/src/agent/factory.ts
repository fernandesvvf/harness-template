// factory — único ponto de instanciação (P3 Factory + P2 DI).
// new XService() só aparece aqui em todo o projeto.
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
import { buildAgentGraph, tools } from './graph.js'

// Memória opt-in: lê o memory.md do projeto e instancia só os tipos enabled.
// MEMORY_DISABLED=1 desliga tudo (baseline do memory-impact eval: com vs sem memória).
function buildMemory() {
  if (process.env.MEMORY_DISABLED === '1') {
    return { longTerm: null, episodic: null, contextual: null }
  }
  let contract
  try {
    contract = loadMemoryContract(resolve(process.cwd(), 'memory.md'))
  } catch (err) {
    logger.warn({ err }, 'memory.md não carregado — memória persistida desabilitada')
    return { longTerm: null, episodic: null, contextual: null }
  }

  const longTerm = contract.memorias.longa.enabled ? new LongTermMemoryService() : null

  const epPolicy = contract.memorias.episodica
  const episodic = epPolicy.enabled ? new EpisodicMemoryService(epPolicy.ttl_dias) : null

  const ctxPolicy = contract.memorias.contextual
  const contextual = ctxPolicy.enabled
    ? new ContextualMemoryService(
        makeEmbedder(),
        { limiar: ctxPolicy.limiar, maxFragmentos: ctxPolicy.max_fragmentos },
        config.memory.embeddingDim,
      )
    : null

  return { longTerm, episodic, contextual }
}

export function buildAgent() {
  const { longTerm, episodic, contextual } = buildMemory()
  const memoryEnabled = Boolean(longTerm || episodic || contextual)

  const deps = {
    // Um OpenRouterService por nó LLM (modelo especializado + isolamento de rate limit).
    guardrailsLlm: new OpenRouterService(config.models.guardrails),
    agentLlm: new OpenRouterService(config.models.agent),
    // LLM de escrita de memória — só instancia se há memória persistida ligada.
    memoryLlm: memoryEnabled ? new OpenRouterService(config.models.memory) : null,
    tools,
    longTerm,
    episodic,
    contextual,
  }
  return buildAgentGraph(deps)
}
