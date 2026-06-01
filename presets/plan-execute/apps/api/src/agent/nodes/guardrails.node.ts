// INFRA — padrão fail-safe. Não mudar a estrutura, só o prompt.
import type { OpenRouterService } from '../../services/openrouter.service.js'
import type { AgentState } from '../graph.js'
import { logger } from '../../utils/logger.js'
import {
  GuardrailsOutputSchema,
  getGuardrailsSystemPrompt,
  getGuardrailsUserPrompt,
} from '../../prompts/v1/guardrails.prompt.js'

export function makeGuardrailsNode(llm: OpenRouterService) {
  return async function guardrailsNode(state: AgentState): Promise<Partial<AgentState>> {
    try {
      const result = await llm.generateStructured(
        getGuardrailsSystemPrompt(),
        getGuardrailsUserPrompt(state.question ?? ''),
        GuardrailsOutputSchema,
      )

      if (!result.success) {
        logger.warn({ error: result.error }, 'guardrails LLM falhou — bloqueando por padrão')
        return { isBlocked: true, blockReason: 'Não foi possível validar a pergunta. Tente novamente.' }
      }

      if (!result.data.safe) {
        logger.warn({ reason: result.data.reason }, 'guardrails bloqueou pergunta')
        return { isBlocked: true, blockReason: result.data.reason }
      }

      return { isBlocked: false }
    } catch (err) {
      logger.error({ err }, 'guardrails lançou exceção — bloqueando por padrão')
      return { isBlocked: true, blockReason: 'Não foi possível validar a pergunta. Tente novamente.' }
    }
  }
}
