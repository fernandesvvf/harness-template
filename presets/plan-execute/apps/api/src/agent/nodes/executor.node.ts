// executor node — Fase 2 (SEM LLM). Roda UM step do plano por vez (loop via edge).
// I/O node: structuredClone no resultado, try/catch, retorno parcial imutável.
import type { AgentState } from '../graph.js'
import { logger } from '../../utils/logger.js'
import { toolRegistry } from '../../tools/registry.js'

export function makeExecutorNode() {
  return async function executorNode(state: AgentState): Promise<Partial<AgentState>> {
    const plan = state.plan ?? []
    const idx = state.currentStep ?? 0
    const step = plan[idx]
    if (!step) return { currentStep: idx + 1 }

    const fn = toolRegistry[step.tool]
    let result: unknown
    if (!fn) {
      result = { erro: `tool desconhecida: ${step.tool}` }
    } else {
      try {
        result = structuredClone(await fn(step.args))
      } catch (err) {
        logger.warn({ err, tool: step.tool }, 'executor: tool falhou')
        result = { erro: 'falha ao executar a tool' }
      }
    }

    // Imutabilidade (P9): retorna parcial, LangGraph faz o merge.
    return {
      subResults: [...(state.subResults ?? []), { tool: step.tool, args: step.args, result }],
      currentStep: idx + 1,
    }
  }
}
