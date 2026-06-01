// edge-conditions — roteamento PURO (P5). Sem I/O, sem config import direto.
import type { AgentState } from '../graph.js'

export function routeAfterGuardrails(state: AgentState): 'generator' | 'blocked' {
  return state.isBlocked ? 'blocked' : 'generator'
}

/**
 * Reflection: critic loop. maxIter por parâmetro (Configuration as Code) — função pura.
 * Para se aprovado OU atingiu o teto. Guarda "critério de parada mal definido → loop infinito".
 * expect(routeAfterCritic({ approved: false, iterations: 3 }, 3)).toBe('end')
 */
export function routeAfterCritic(state: AgentState, maxIter: number): 'generator' | 'end' {
  if (state.approved) return 'end'
  if ((state.iterations ?? 0) >= maxIter) return 'end'
  return 'generator'
}
