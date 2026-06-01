import { StateGraph, END, START } from '@langchain/langgraph'
import { z } from 'zod/v3'
import type { OpenRouterService } from '../services/openrouter.service.js'
import { config } from '../config.js'
import { makeGuardrailsNode } from './nodes/guardrails.node.js'
import { blockedNode } from './nodes/blocked.node.js'
import { makePlannerNode } from './nodes/planner.node.js'
import { makeExecutorNode } from './nodes/executor.node.js'
import { makeSynthesizerNode } from './nodes/synthesizer.node.js'
import { routeAfterGuardrails, routeAfterExecutor } from './nodes/edge-conditions.js'

// ARQUITETURA: Plan-Execute — planner → executor* → synthesizer.
// Execução mecânica sem LLM no meio (P14). Previsível e barato.
const AgentStateAnnotation = z.object({
  question: z.string().optional(),

  // Guardrails
  isBlocked: z.boolean().optional(),
  blockReason: z.string().optional(),

  // Plano e execução (CURTA — estado da execução)
  plan: z.array(z.object({ tool: z.string(), args: z.record(z.any()) })).optional(),
  currentStep: z.number().optional(),
  subResults: z
    .array(z.object({ tool: z.string(), args: z.record(z.any()), result: z.any() }))
    .optional(),

  finalAnswer: z.string().optional(),
})

export type AgentState = z.infer<typeof AgentStateAnnotation>

export interface AgentDeps {
  guardrailsLlm: OpenRouterService
  plannerLlm: OpenRouterService
  synthesizerLlm: OpenRouterService
}

export function buildAgentGraph(deps: AgentDeps) {
  const { guardrailsLlm, plannerLlm, synthesizerLlm } = deps

  return new StateGraph({ state: AgentStateAnnotation })
    .addNode('guardrails', makeGuardrailsNode(guardrailsLlm))
    .addNode('blocked', blockedNode)
    .addNode('planner', makePlannerNode(plannerLlm, config.agent.plannerMaxSteps))
    .addNode('executor', makeExecutorNode())
    .addNode('synthesizer', makeSynthesizerNode(synthesizerLlm))
    .addEdge(START, 'guardrails')
    .addConditionalEdges('guardrails', (s: AgentState) => routeAfterGuardrails(s), {
      planner: 'planner',
      blocked: 'blocked',
    })
    .addEdge('blocked', END)
    .addEdge('planner', 'executor')
    // Loop mecânico: um step por vez até o plano acabar.
    .addConditionalEdges('executor', (s: AgentState) => routeAfterExecutor(s), {
      executor: 'executor',
      synthesizer: 'synthesizer',
    })
    .addEdge('synthesizer', END)
    .compile()
}
