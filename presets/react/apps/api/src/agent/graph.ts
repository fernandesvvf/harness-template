import { StateGraph, END, START, MessagesZodMeta } from '@langchain/langgraph'
import { ToolNode } from '@langchain/langgraph/prebuilt'
import { withLangGraph } from '@langchain/langgraph/zod'
import { z } from 'zod/v3'
import type { BaseMessage } from '@langchain/core/messages'
import type { StructuredToolInterface } from '@langchain/core/tools'
import type { OpenRouterService } from '../services/openrouter.service.js'
import { config } from '../config.js'
import { makeGuardrailsNode } from './nodes/guardrails.node.js'
import { blockedNode } from './nodes/blocked.node.js'
import { makeAgentNode } from './nodes/agent.node.js'
import { routeAfterGuardrails, routeAfterAgent } from './nodes/edge-conditions.js'
import { tools } from '../tools/index.js'

// ARQUITETURA: ReAct — loop agent → tools → agent até resposta final ou teto de steps.
const AgentStateAnnotation = z.object({
  // CURTA (memória de execução): histórico de mensagens com tool_calls/observações.
  // Reducer MessagesZodMeta acumula append automaticamente. Morre com a execução.
  messages: withLangGraph(z.custom<BaseMessage[]>(), MessagesZodMeta),

  // Pergunta original — usada pelo guardrails.
  question: z.string().optional(),

  // Guardrails
  isBlocked: z.boolean().optional(),
  blockReason: z.string().optional(),

  // Controle do loop ReAct (teto = config.agent.reactMaxSteps)
  stepCount: z.number().optional(),

  // Resposta final em texto (preenchida quando o agente para de chamar tools)
  finalAnswer: z.string().optional(),
})

export type AgentState = z.infer<typeof AgentStateAnnotation>

export interface AgentDeps {
  guardrailsLlm: OpenRouterService
  agentLlm: OpenRouterService
  tools: StructuredToolInterface[]
}

export function buildAgentGraph(deps: AgentDeps) {
  const { guardrailsLlm, agentLlm } = deps
  const agentTools = deps.tools

  // ToolNode (built-in) executa as tool_calls da última AIMessage.
  const toolNode = new ToolNode(agentTools)

  return new StateGraph({ state: AgentStateAnnotation })
    .addNode('guardrails', makeGuardrailsNode(guardrailsLlm))
    .addNode('blocked', blockedNode)
    .addNode('agent', makeAgentNode(agentLlm, agentTools))
    .addNode('tools', toolNode)
    .addEdge(START, 'guardrails')
    .addConditionalEdges('guardrails', (s: AgentState) => routeAfterGuardrails(s), {
      agent: 'agent',
      blocked: 'blocked',
    })
    .addEdge('blocked', END)
    // Loop ReAct: aplicação parcial do teto de steps aqui (Configuration as Code).
    .addConditionalEdges('agent', (s: AgentState) => routeAfterAgent(s, config.agent.reactMaxSteps), {
      tools: 'tools',
      end: END,
    })
    .addEdge('tools', 'agent') // observação volta pro agente raciocinar
    .compile()
}

// reexport pro server/factory/evals montarem deps sem duplicar a lista
export { tools }
