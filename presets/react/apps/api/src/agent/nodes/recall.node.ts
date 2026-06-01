// recall node — io-node (P11). Consulta LONGA + CONTEXTUAL e monta o memoryContext.
// Serviços nullable = tipo desabilitado no memory.md (DI; nó não conhece a política).
//
// CONTEXTUAL já aplica limiar + max_fragmentos no service (guarda IRRELEVANTE).
import type { LongTermMemoryService, ContextualMemoryService } from '@harness/memory'
import type { AgentState } from '../graph.js'
import { logger } from '../../utils/logger.js'

export function makeRecallNode(
  longTerm: LongTermMemoryService | null,
  contextual: ContextualMemoryService | null,
) {
  return async function recallNode(state: AgentState): Promise<Partial<AgentState>> {
    const userId = state.userId ?? 'demo'
    const question = state.question ?? ''
    const parts: string[] = []

    // LONGA — fatos confirmados do usuário ("caderno", persiste sempre)
    if (longTerm) {
      try {
        const facts = await longTerm.getContextForPrompt(userId)
        if (facts) parts.push(`Fatos conhecidos:\n${facts}`)
      } catch (err) {
        logger.warn({ err }, 'recall: LONGA falhou — seguindo sem')
      }
    }

    // CONTEXTUAL — fragmentos por similaridade ("google interno", sob demanda)
    if (contextual && question) {
      try {
        const fragments = await contextual.query(question)
        if (fragments.length > 0) {
          const text = fragments.map((f) => `- ${f.content} (rel: ${f.score.toFixed(2)})`).join('\n')
          parts.push(`Trechos relevantes:\n${text}`)
        }
      } catch (err) {
        logger.warn({ err }, 'recall: CONTEXTUAL falhou — seguindo sem')
      }
    }

    // Sem memória recuperada = state inalterado (não polui o contexto)
    return parts.length > 0 ? { memoryContext: parts.join('\n\n') } : {}
  }
}
