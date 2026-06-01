import { StateGraph, END, START } from '@langchain/langgraph'
import { z } from 'zod/v3'
import type { LongTermMemoryService, EpisodicMemoryService } from '@harness/memory'
import type { OpenRouterService } from '../services/openrouter.service.js'
import { config } from '../config.js'
import { makeGuardrailsNode } from './nodes/guardrails.node.js'
import { blockedNode } from './nodes/blocked.node.js'
import { makeRecallNode } from './nodes/recall.node.js'
import { makePlannerNode } from './nodes/planner.node.js'
import { makeExecutorNode } from './nodes/executor.node.js'
import { makeSynthesizerNode } from './nodes/synthesizer.node.js'
import { makeEvaluateNode } from './nodes/evaluate.node.js'
import { makePersistNode } from './nodes/persist.node.js'
import { routeAfterGuardrails, routeAfterExecutor } from './nodes/edge-conditions.js'

// ARQUITETURA: Plan-Execute — planner → executor* → synthesizer.
// Ciclo completo: recuperar(recall) → planejar(planner) → agir(executor) →
//   perceber/sintetizar(synthesizer) → avaliar(evaluate) → persistir(persist).
const AgentStateAnnotation = z.object({
  question: z.string().optional(),

  // Partição/execução da memória
  scopeId: z.string().optional(),
  runId: z.string().optional(),

  // Guardrails
  isBlocked: z.boolean().optional(),
  blockReason: z.string().optional(),

  // Memória recuperada (recall) injetada no planner
  memoryContext: z.string().optional(),

  // Plano e execução (CURTA — estado da execução)
  plan: z.array(z.object({ tool: z.string(), args: z.record(z.any()) })).optional(),
  currentStep: z.number().optional(),
  subResults: z
    .array(z.object({ tool: z.string(), args: z.record(z.any()), result: z.any() }))
    .optional(),

  finalAnswer: z.string().optional(),

  // Fase "avaliar" (fail-open)
  evalScore: z.number().optional(),
  evalOk: z.boolean().optional(),
})

export type AgentState = z.infer<typeof AgentStateAnnotation>

export interface AgentDeps {
  guardrailsLlm: OpenRouterService
  plannerLlm: OpenRouterService
  synthesizerLlm: OpenRouterService
  memoryLlm: OpenRouterService | null
  longTerm: LongTermMemoryService | null
  episodic: EpisodicMemoryService | null
}

export function buildAgentGraph(deps: AgentDeps) {
  const { guardrailsLlm, plannerLlm, synthesizerLlm, memoryLlm, longTerm, episodic } = deps
  const memoryEnabled = Boolean(longTerm || episodic)

  const builder = new StateGraph({ state: AgentStateAnnotation })
    .addNode('guardrails', makeGuardrailsNode(guardrailsLlm))
    .addNode('blocked', blockedNode)
    .addNode('recall', makeRecallNode(longTerm, episodic))
    .addNode('planner', makePlannerNode(plannerLlm, config.agent.plannerMaxSteps))
    .addNode('executor', makeExecutorNode())
    .addNode('synthesizer', makeSynthesizerNode(synthesizerLlm))
    .addNode('evaluate', makeEvaluateNode(memoryLlm))
    .addEdge(START, 'guardrails')
    .addConditionalEdges('guardrails', (s: AgentState) => routeAfterGuardrails(s), {
      planner: 'recall', // recupera contexto antes de planejar
      blocked: 'blocked',
    })
    .addEdge('blocked', END)
    .addEdge('recall', 'planner')
    .addEdge('planner', 'executor')
    // Loop mecânico: um step por vez até o plano acabar.
    .addConditionalEdges('executor', (s: AgentState) => routeAfterExecutor(s), {
      executor: 'executor',
      synthesizer: 'synthesizer',
    })
    .addEdge('synthesizer', 'evaluate')

  // ...avaliar → persistir (persist só se há memória ligada; senão órfão).
  if (memoryEnabled) {
    builder
      .addNode('persist', makePersistNode({ memoryLlm, longTerm, episodic }))
      .addEdge('evaluate', 'persist')
      .addEdge('persist', END)
  } else {
    builder.addEdge('evaluate', END)
  }

  return builder.compile()
}
