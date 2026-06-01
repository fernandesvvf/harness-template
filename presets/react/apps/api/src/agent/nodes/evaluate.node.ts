// evaluate node — fase "avaliar" do ciclo. Auto-avaliação leve, FAIL-OPEN.
// Nunca bloqueia: registra score/ok no state. score baixo vira sinal pro persist
// (reforça a extração de lição na reflexão evolutiva).
import type { OpenRouterService } from '../../services/openrouter.service.js'
import type { AgentState } from '../graph.js'
import { logger } from '../../utils/logger.js'
import { EvaluateSchema, getEvaluateSystemPrompt, getEvaluateUserPrompt } from '../../prompts/v1/evaluate.prompt.js'

// DI: usa o LLM de memória (barato). null = avaliação desligada (segue sem).
export function makeEvaluateNode(llm: OpenRouterService | null) {
  return async function evaluateNode(state: AgentState): Promise<Partial<AgentState>> {
    if (!llm) return {}
    const answer = state.finalAnswer ?? ''
    if (!answer) return {}

    try {
      const res = await llm.generateStructured(
        getEvaluateSystemPrompt(),
        getEvaluateUserPrompt(state.question ?? '', answer),
        EvaluateSchema,
      )
      if (!res.success) {
        logger.warn({ error: res.error }, 'evaluate falhou — fail-open, seguindo')
        return {}
      }
      logger.info({ score: res.data.score, ok: res.data.ok }, 'evaluate: auto-avaliação')
      // fail-open: só registra. NÃO bloqueia, NÃO altera a resposta.
      return { evalScore: res.data.score, evalOk: res.data.ok }
    } catch (err) {
      logger.warn({ err }, 'evaluate exceção — fail-open, seguindo')
      return {}
    }
  }
}
