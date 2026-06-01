// factory — único ponto de instanciação (P3 Factory + P2 DI).
import { OpenRouterService } from '../services/openrouter.service.js'
import { config } from '../config.js'
import { buildAgentGraph } from './graph.js'

export function buildAgent() {
  const deps = {
    guardrailsLlm: new OpenRouterService(config.models.guardrails),
    generatorLlm: new OpenRouterService(config.models.generator),
    // CRITIC_MODEL = GENERATOR_MODEL → self-reflection (barato).
    // CRITIC_MODEL = modelo maior   → cross-reflection (caro, melhor).
    criticLlm: new OpenRouterService(config.models.critic),
  }
  return buildAgentGraph(deps)
}
