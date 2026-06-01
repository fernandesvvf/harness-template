// recall node — fase "recuperar contexto". io-node (P11).
// Plan-execute usa só memória por FILTRO (LONGA + EPISÓDICA-resumo) — sem busca
// semântica (CONTEXTUAL é p/ caminho aberto, não p/ fluxo previsível).
import type { LongTermMemoryService, EpisodicMemoryService } from '@harness/memory'
import type { AgentState } from '../graph.js'
import { logger } from '../../utils/logger.js'

export function makeRecallNode(
  longTerm: LongTermMemoryService | null,
  episodic: EpisodicMemoryService | null,
) {
  return async function recallNode(state: AgentState): Promise<Partial<AgentState>> {
    const scopeId = state.scopeId ?? 'global'
    const parts: string[] = []

    if (longTerm) {
      try {
        const facts = await longTerm.getContextForPrompt(scopeId)
        if (facts) parts.push(`Fatos conhecidos:\n${facts}`)
      } catch (err) {
        logger.warn({ err }, 'recall: LONGA falhou — seguindo sem')
      }
    }

    if (episodic) {
      try {
        const past = await episodic.getContextForPrompt(scopeId)
        if (past) parts.push(`Execuções anteriores:\n${past}`)
      } catch (err) {
        logger.warn({ err }, 'recall: EPISÓDICA falhou — seguindo sem')
      }
    }

    return parts.length > 0 ? { memoryContext: parts.join('\n\n') } : {}
  }
}
