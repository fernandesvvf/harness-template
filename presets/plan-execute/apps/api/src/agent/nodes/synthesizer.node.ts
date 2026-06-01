// synthesizer node — Fase 3 (1 LLM call). Monta a resposta final dos resultados.
import type { OpenRouterService } from '../../services/openrouter.service.js'
import type { AgentState } from '../graph.js'
import { logger } from '../../utils/logger.js'
import { SynthesisSchema, getSynthesizerSystemPrompt, getSynthesizerUserPrompt } from '../../prompts/v1/synthesizer.prompt.js'

export function makeSynthesizerNode(llm: OpenRouterService) {
  return async function synthesizerNode(state: AgentState): Promise<Partial<AgentState>> {
    try {
      const result = await llm.generateStructured(
        getSynthesizerSystemPrompt(),
        getSynthesizerUserPrompt(state.question ?? '', state.subResults ?? []),
        SynthesisSchema,
      )
      if (!result.success) {
        logger.warn({ error: result.error }, 'synthesizer falhou')
        return { finalAnswer: 'Coletei os dados mas não consegui montar a resposta final.' }
      }
      return { finalAnswer: result.data.answer }
    } catch (err) {
      logger.error({ err }, 'synthesizer lançou exceção')
      return { finalAnswer: 'Não consegui montar a resposta final.' }
    }
  }
}
