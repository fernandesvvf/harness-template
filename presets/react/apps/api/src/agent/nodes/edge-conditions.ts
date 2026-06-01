// edge-conditions — roteamento PURO (P5). Sem I/O, sem config import direto.
import { AIMessage } from '@langchain/core/messages'
import type { AgentState } from '../graph.js'

export function routeAfterGuardrails(state: AgentState): 'agent' | 'blocked' {
  return state.isBlocked ? 'blocked' : 'agent'
}

/**
 * shouldContinue do ReAct. maxSteps vem por parâmetro (Configuration as Code) —
 * a função continua pura e testável: expect(routeAfterAgent({...}, 6)).toBe('end').
 *
 * Para 'tools' se a última msg tem tool_calls E ainda há orçamento.
 * Senão 'end' — guarda a falha "contexto longo → alucina no meio do loop".
 */
export function routeAfterAgent(state: AgentState, maxSteps: number): 'tools' | 'end' {
  if ((state.stepCount ?? 0) >= maxSteps) return 'end'

  const last = (state.messages ?? []).at(-1)
  if (last instanceof AIMessage && (last.tool_calls ?? []).length > 0) return 'tools'

  return 'end'
}
