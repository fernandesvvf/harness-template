import { StateGraph, END, START } from '@langchain/langgraph'
import { z } from 'zod/v3'
import type {
  LongTermMemoryService,
  EpisodicMemoryService,
  ContextualMemoryService,
} from '@harness/memory'
import type { OpenRouterService } from '../services/openrouter.service.js'
import { config } from '../config.js'
import { makeGuardrailsNode } from './nodes/guardrails.node.js'
import { blockedNode } from './nodes/blocked.node.js'
import { makeRecallNode } from './nodes/recall.node.js'
import { makeGeneratorNode } from './nodes/generator.node.js'
import { makeCriticNode } from './nodes/critic.node.js'
import { makePersistNode } from './nodes/persist.node.js'
import { routeAfterGuardrails, routeAfterCritic } from './nodes/edge-conditions.js'

// ARQUITETURA: Reflection — generator ⇄ critic até aprovar ou atingir o teto.
// Ciclo: recuperar(recall) → perceber/planejar/agir(generator) → AVALIAR(critic) →
//   persistir(persist). O critic É a fase "avaliar" desta arquitetura.
const AgentStateAnnotation = z.object({
  question: z.string().optional(),

  // Partição/execução da memória
  scopeId: z.string().optional(),
  runId: z.string().optional(),

  // Guardrails
  isBlocked: z.boolean().optional(),
  blockReason: z.string().optional(),

  // Memória recuperada (recall) injetada no generator
  memoryContext: z.string().optional(),

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
  memoryLlm: OpenRouterService | null
  longTerm: LongTermMemoryService | null
  episodic: EpisodicMemoryService | null
  contextual: ContextualMemoryService | null
}

export function buildAgentGraph(deps: AgentDeps) {
  const { guardrailsLlm, generatorLlm, criticLlm, memoryLlm, longTerm, episodic, contextual } = deps
  const memoryEnabled = Boolean(longTerm || episodic || contextual)

  const builder = new StateGraph({ state: AgentStateAnnotation })
    .addNode('guardrails', makeGuardrailsNode(guardrailsLlm))
    .addNode('blocked', blockedNode)
    .addNode('recall', makeRecallNode(longTerm, episodic, contextual))
    .addNode('generator', makeGeneratorNode(generatorLlm))
    .addNode('critic', makeCriticNode(criticLlm))
    .addEdge(START, 'guardrails')
    .addConditionalEdges('guardrails', (s: AgentState) => routeAfterGuardrails(s), {
      generator: 'recall', // recupera contexto (+ lições passadas) antes de gerar
      blocked: 'blocked',
    })
    .addEdge('blocked', END)
    .addEdge('recall', 'generator')
    .addEdge('generator', 'critic')

  // Loop: critic (= fase avaliar) aprova → persist (se há memória) ; reprova → generator.
  if (memoryEnabled) {
    builder
      .addNode('persist', makePersistNode({ memoryLlm, longTerm, episodic, contextual }))
      .addConditionalEdges('critic', (s: AgentState) => routeAfterCritic(s, config.agent.reflectionMaxIter), {
        generator: 'generator',
        end: 'persist',
      })
      .addEdge('persist', END)
  } else {
    builder.addConditionalEdges('critic', (s: AgentState) => routeAfterCritic(s, config.agent.reflectionMaxIter), {
      generator: 'generator',
      end: END,
    })
  }

  return builder.compile()
}
