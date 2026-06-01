// edge-conditions — roteamento PURO (P5). Sem I/O, sem config import direto.
import type { AgentState } from '../graph.js'

export function routeAfterGuardrails(state: AgentState): 'planner' | 'blocked' {
  return state.isBlocked ? 'blocked' : 'planner'
}

/**
 * Plan-Execute: loop mecânico do executor até o plano acabar, depois sintetiza.
 * Puro — testável: expect(routeAfterExecutor({ plan: [], currentStep: 0 })).toBe('synthesizer').
 */
export function routeAfterExecutor(state: AgentState): 'executor' | 'synthesizer' {
  const plan = state.plan ?? []
  const done = (state.currentStep ?? 0) >= plan.length
  return done ? 'synthesizer' : 'executor'
}
