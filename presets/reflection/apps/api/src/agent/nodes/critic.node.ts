// critic node — avalia o draft. approved=true encerra; senão devolve feedback.
// self-reflection (mesmo modelo) ou cross (modelo maior) — definido em config/factory.
import type { OpenRouterService } from '../../services/openrouter.service.js'
import type { AgentState } from '../graph.js'
import { logger } from '../../utils/logger.js'
import { CriticSchema, getCriticSystemPrompt, getCriticUserPrompt } from '../../prompts/v1/critic.prompt.js'

export function makeCriticNode(llm: OpenRouterService) {
  return async function criticNode(state: AgentState): Promise<Partial<AgentState>> {
    const iterations = (state.iterations ?? 0) + 1
    try {
      const result = await llm.generateStructured(
        getCriticSystemPrompt(),
        getCriticUserPrompt(state.question ?? '', state.draft ?? ''),
        CriticSchema,
      )
      if (!result.success) {
        // Fail-safe: critic falhou → aprova o draft atual pra não travar.
        logger.warn({ error: result.error }, 'critic falhou — aprovando draft atual')
        return { approved: true, iterations, finalAnswer: state.draft }
      }
      const approved = result.data.approved
      return {
        approved,
        critique: approved ? undefined : result.data.feedback,
        iterations,
        ...(approved ? { finalAnswer: state.draft } : {}),
      }
    } catch (err) {
      logger.error({ err }, 'critic lançou exceção — aprovando draft atual')
      return { approved: true, iterations, finalAnswer: state.draft }
    }
  }
}
