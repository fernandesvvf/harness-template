// factory — único ponto de instanciação (P3 Factory + P2 DI).
// new XService() só aparece aqui em todo o projeto.
import { OpenRouterService } from '../services/openrouter.service.js'
import { config } from '../config.js'
import { buildAgentGraph, tools } from './graph.js'

export function buildAgent() {
  const deps = {
    // Um OpenRouterService por nó LLM (modelo especializado + isolamento de rate limit).
    guardrailsLlm: new OpenRouterService(config.models.guardrails),
    agentLlm: new OpenRouterService(config.models.agent),
    tools,
  }
  return buildAgentGraph(deps)
}
