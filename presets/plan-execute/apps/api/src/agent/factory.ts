// factory — único ponto de instanciação (P3 Factory + P2 DI).
import { resolve } from 'node:path'
import { loadMemoryContract, LongTermMemoryService, EpisodicMemoryService } from '@harness/memory'
import { OpenRouterService } from '../services/openrouter.service.js'
import { config } from '../config.js'
import { logger } from '../utils/logger.js'
import { buildAgentGraph } from './graph.js'

// Memória opt-in (plan-execute usa só LONGA + EPISÓDICA — busca por filtro).
// MEMORY_DISABLED=1 desliga tudo (baseline do memory-impact eval).
function buildMemory() {
  if (process.env.MEMORY_DISABLED === '1') return { longTerm: null, episodic: null }
  let contract
  try {
    contract = loadMemoryContract(resolve(process.cwd(), 'memory.md'))
  } catch (err) {
    logger.warn({ err }, 'memory.md não carregado — memória persistida desabilitada')
    return { longTerm: null, episodic: null }
  }
  const longTerm = contract.memorias.longa.enabled ? new LongTermMemoryService() : null
  const ep = contract.memorias.episodica
  const episodic = ep.enabled ? new EpisodicMemoryService(ep.ttl_dias) : null
  return { longTerm, episodic }
}

export function buildAgent() {
  const { longTerm, episodic } = buildMemory()
  const memoryEnabled = Boolean(longTerm || episodic)

  const deps = {
    guardrailsLlm: new OpenRouterService(config.models.guardrails),
    plannerLlm: new OpenRouterService(config.models.planner),
    synthesizerLlm: new OpenRouterService(config.models.synthesizer),
    // executor não usa LLM (Plan-Execute)
    memoryLlm: memoryEnabled ? new OpenRouterService(config.models.memory) : null,
    longTerm,
    episodic,
  }
  return buildAgentGraph(deps)
}
