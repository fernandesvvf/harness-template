// planner node — Fase 1 (1 LLM call). Decompõe + parametriza a tarefa.
import type { OpenRouterService } from '../../services/openrouter.service.js'
import type { AgentState } from '../graph.js'
import { logger } from '../../utils/logger.js'
import { PlanSchema, getPlannerSystemPrompt, getPlannerUserPrompt } from '../../prompts/v1/planner.prompt.js'

export function makePlannerNode(llm: OpenRouterService, maxSteps: number) {
  return async function plannerNode(state: AgentState): Promise<Partial<AgentState>> {
    try {
      const result = await llm.generateStructured(
        getPlannerSystemPrompt(maxSteps),
        getPlannerUserPrompt(state.question ?? '', state.memoryContext),
        PlanSchema,
      )
      if (!result.success) {
        // Graceful Degradation (P9): plano de 1 step com a pergunta original.
        logger.warn({ error: result.error }, 'planner falhou — fallback de 1 step')
        return { plan: [{ tool: 'buscar_produto', args: { nome: state.question ?? '' } }], currentStep: 0 }
      }
      return { plan: result.data.steps, currentStep: 0, subResults: [] }
    } catch (err) {
      logger.error({ err }, 'planner lançou exceção')
      return { plan: [], currentStep: 0, subResults: [], finalAnswer: 'Não consegui planejar a tarefa.' }
    }
  }
}
