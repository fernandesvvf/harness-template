// generator node — gera/melhora a resposta. Na 2ª+ iteração usa a crítica anterior.
import type { OpenRouterService } from '../../services/openrouter.service.js'
import type { AgentState } from '../graph.js'
import { logger } from '../../utils/logger.js'
import { GeneratorSchema, getGeneratorSystemPrompt, getGeneratorUserPrompt } from '../../prompts/v1/generator.prompt.js'

export function makeGeneratorNode(llm: OpenRouterService) {
  return async function generatorNode(state: AgentState): Promise<Partial<AgentState>> {
    try {
      const result = await llm.generateStructured(
        getGeneratorSystemPrompt(),
        getGeneratorUserPrompt(state.question ?? '', state.draft, state.critique, state.memoryContext),
        GeneratorSchema,
      )
      if (!result.success) {
        logger.warn({ error: result.error }, 'generator falhou')
        return { draft: state.draft ?? 'Não consegui gerar uma resposta.' }
      }
      return { draft: result.data.answer }
    } catch (err) {
      logger.error({ err }, 'generator lançou exceção')
      return { draft: state.draft ?? 'Não consegui gerar uma resposta.' }
    }
  }
}
