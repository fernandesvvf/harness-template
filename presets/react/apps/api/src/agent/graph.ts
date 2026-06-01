import { StateGraph, END, START, MessagesZodMeta } from '@langchain/langgraph'
import { ToolNode } from '@langchain/langgraph/prebuilt'
import { withLangGraph } from '@langchain/langgraph/zod'
import { z } from 'zod/v3'
import type { BaseMessage } from '@langchain/core/messages'
import type { StructuredToolInterface } from '@langchain/core/tools'
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
import { makeAgentNode } from './nodes/agent.node.js'
import { makePersistNode } from './nodes/persist.node.js'
import { routeAfterGuardrails, routeAfterAgent } from './nodes/edge-conditions.js'
import { tools } from '../tools/index.js'

// ARQUITETURA: ReAct — loop agent → tools → agent até resposta final ou teto de steps.
// Memória: CURTA (messages) + LONGA + EPISÓDICA + CONTEXTUAL.
//   leitura no nó recall (antes do agent) ; escrita no nó persist (antes do END).
const AgentStateAnnotation = z.object({
  // CURTA (memória de execução): histórico de mensagens com tool_calls/observações.
  messages: withLangGraph(z.custom<BaseMessage[]>(), MessagesZodMeta),

  // Pergunta original — usada pelo guardrails e pela busca CONTEXTUAL.
  question: z.string().optional(),

  // Chave de partição da memória (genérico: chat=userId, automação=tenant/job/global).
  scopeId: z.string().optional(),
  // Id da execução atual — chave da EPISÓDICA e do fragmento CONTEXTUAL.
  runId: z.string().optional(),

  // Guardrails
  isBlocked: z.boolean().optional(),
  blockReason: z.string().optional(),

  // Memória recuperada (LONGA + EPISÓDICA + CONTEXTUAL) injetada no system prompt.
  memoryContext: z.string().optional(),

  // Controle do loop ReAct (teto = config.agent.reactMaxSteps)
  stepCount: z.number().optional(),

  // Resposta final em texto (preenchida quando o agente para de chamar tools)
  finalAnswer: z.string().optional(),
})

export type AgentState = z.infer<typeof AgentStateAnnotation>

export interface AgentDeps {
  guardrailsLlm: OpenRouterService
  agentLlm: OpenRouterService
  // LLM dedicado à escrita de memória (extração de fatos + resumo).
  memoryLlm: OpenRouterService | null
  tools: StructuredToolInterface[]
  // Memória opt-in — null = tipo desabilitado no memory.md.
  longTerm: LongTermMemoryService | null
  episodic: EpisodicMemoryService | null
  contextual: ContextualMemoryService | null
}

export function buildAgentGraph(deps: AgentDeps) {
  const { guardrailsLlm, agentLlm, memoryLlm, longTerm, episodic, contextual } = deps
  const agentTools = deps.tools

  const toolNode = new ToolNode(agentTools)
  const memoryEnabled = Boolean(longTerm || episodic || contextual)

  return new StateGraph({ state: AgentStateAnnotation })
    .addNode('guardrails', makeGuardrailsNode(guardrailsLlm))
    .addNode('blocked', blockedNode)
    .addNode('recall', makeRecallNode(longTerm, episodic, contextual))
    .addNode('agent', makeAgentNode(agentLlm, agentTools))
    .addNode('tools', toolNode)
    .addNode('persist', makePersistNode({ memoryLlm, longTerm, episodic, contextual, maxSteps: config.agent.reactMaxSteps }))
    .addEdge(START, 'guardrails')
    .addConditionalEdges('guardrails', (s: AgentState) => routeAfterGuardrails(s), {
      agent: 'recall', // passa pelo recall antes de raciocinar
      blocked: 'blocked',
    })
    .addEdge('blocked', END)
    .addEdge('recall', 'agent')
    // Loop ReAct: aplicação parcial do teto de steps (Configuration as Code).
    // Ao terminar, passa por persist (escrita de memória) se houver memória ligada.
    .addConditionalEdges('agent', (s: AgentState) => routeAfterAgent(s, config.agent.reactMaxSteps), {
      tools: 'tools',
      end: memoryEnabled ? 'persist' : END,
    })
    .addEdge('tools', 'agent') // observação volta pro agente raciocinar
    .addEdge('persist', END)
    .compile()
}

// reexport pro server/factory/evals montarem deps sem duplicar a lista
export { tools }
