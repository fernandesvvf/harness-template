// INFRA — terminal de bloqueio. Não mudar a estrutura.
import type { AgentState } from '../graph.js'

export function blockedNode(state: AgentState): Partial<AgentState> {
  return {
    finalAnswer: state.blockReason ?? 'Não posso responder a esta pergunta.',
  }
}
