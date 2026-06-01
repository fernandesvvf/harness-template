import { StateGraph, END, START } from '@langchain/langgraph'
import { z } from 'zod/v3'
import type { OpenRouterService } from '../services/openrouter.service.js'
import { config } from '../config.js'
import { makeGuardrailsNode } from './nodes/guardrails.node.js'
import { blockedNode } from './nodes/blocked.node.js'
import { makeGeneratorNode } from './nodes/generator.node.js'
import { makeCriticNode } from './nodes/critic.node.js'
import { routeAfterGuardrails, routeAfterCritic } from './nodes/edge-conditions.js'

// ARQUITETURA: Reflection — generator ⇄ critic até aprovar ou atingir o teto.
// Camada de qualidade em cima de um gerador (aqui: nó LLM simples). Teto = reflectionMaxIter.
const AgentStateAnnotation = z.object({
  question: z.string().optional(),

  // Guardrails
  isBlocked: z.boolean().optional(),
  blockReason: z.string().optional(),

  // Critic loop (CURTA — estado da execução)
  draft: z.string().optional(),
  critique: z.string().optional(),
  approved: z.boolean().optional(),
  iterations: z.number().optional(),

  finalAnswer: z.string().optional(),
})

export type AgentState = z.infer<typeof AgentStateAnnotation>

export interface AgentDeps {
  guardrailsLlm: OpenRouterService
  generatorLlm: OpenRouterService
  // self-reflection: mesmo modelo do generator; cross-reflection: modelo maior.
  criticLlm: OpenRouterService
}

export function buildAgentGraph(deps: AgentDeps) {
  const { guardrailsLlm, generatorLlm, criticLlm } = deps

  return new StateGraph({ state: AgentStateAnnotation })
    .addNode('guardrails', makeGuardrailsNode(guardrailsLlm))
    .addNode('blocked', blockedNode)
    .addNode('generator', makeGeneratorNode(generatorLlm))
    .addNode('critic', makeCriticNode(criticLlm))
    .addEdge(START, 'guardrails')
    .addConditionalEdges('guardrails', (s: AgentState) => routeAfterGuardrails(s), {
      generator: 'generator',
      blocked: 'blocked',
    })
    .addEdge('blocked', END)
    .addEdge('generator', 'critic')
    // Loop: aplicação parcial do teto de iterações aqui (Configuration as Code).
    .addConditionalEdges('critic', (s: AgentState) => routeAfterCritic(s, config.agent.reflectionMaxIter), {
      generator: 'generator',
      end: END,
    })
    .compile()
}
