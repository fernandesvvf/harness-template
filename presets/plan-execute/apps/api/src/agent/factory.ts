// factory — único ponto de instanciação (P3 Factory + P2 DI).
import { OpenRouterService } from '../services/openrouter.service.js'
import { config } from '../config.js'
import { buildAgentGraph } from './graph.js'

export function buildAgent() {
  const deps = {
    guardrailsLlm: new OpenRouterService(config.models.guardrails),
    plannerLlm: new OpenRouterService(config.models.planner),
    synthesizerLlm: new OpenRouterService(config.models.synthesizer),
    // executor não usa LLM (Plan-Execute)
  }
  return buildAgentGraph(deps)
}
