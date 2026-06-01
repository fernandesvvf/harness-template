// persist node — escrita de memória ao fim da execução (único ponto de escrita).
// LONGA: LLM extrai fatos duráveis. EPISÓDICA: LLM resume a execução. CONTEXTUAL: indexa.
// Serviços/LLM nullable = tipo desabilitado no memory.md (DI). Tudo fail-safe (P9).
import { AIMessage, ToolMessage } from '@langchain/core/messages'
import type { BaseMessage } from '@langchain/core/messages'
import type {
  LongTermMemoryService,
  EpisodicMemoryService,
  ContextualMemoryService,
} from '@harness/memory'
import type { OpenRouterService } from '../../services/openrouter.service.js'
import type { AgentState } from '../graph.js'
import { logger } from '../../utils/logger.js'
import { FactsSchema, getExtractFactsSystemPrompt, getExtractFactsUserPrompt } from '../../prompts/v1/extract-facts.prompt.js'
import { SummarySchema, getSummarizeRunSystemPrompt, getSummarizeRunUserPrompt } from '../../prompts/v1/summarize-run.prompt.js'

interface PersistDeps {
  memoryLlm: OpenRouterService | null
  longTerm: LongTermMemoryService | null
  episodic: EpisodicMemoryService | null
  contextual: ContextualMemoryService | null
}

function buildTranscript(messages: BaseMessage[], question: string, answer: string): string {
  const turns = messages
    .filter((m) => m instanceof AIMessage || m instanceof ToolMessage)
    .map((m) => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content)))
    .join('\n')
  return `Pergunta: ${question}\n${turns}\nResposta final: ${answer}`
}

export function makePersistNode(deps: PersistDeps) {
  const { memoryLlm, longTerm, episodic, contextual } = deps

  return async function persistNode(state: AgentState): Promise<Partial<AgentState>> {
    const scopeId = state.scopeId ?? 'global'
    const runId = state.runId ?? `run-${Date.now()}`
    const question = state.question ?? ''
    const answer = state.finalAnswer ?? ''
    const transcript = buildTranscript((state.messages ?? []) as BaseMessage[], question, answer)

    // LONGA — extrai fatos duráveis (precisa de LLM)
    if (longTerm && memoryLlm) {
      try {
        const res = await memoryLlm.generateStructured(
          getExtractFactsSystemPrompt(),
          getExtractFactsUserPrompt(transcript),
          FactsSchema,
        )
        if (res.success) {
          for (const f of res.data.facts) await longTerm.upsert(scopeId, f.key, f.value)
          if (res.data.facts.length) logger.info({ n: res.data.facts.length }, 'persist: fatos LONGA gravados')
        }
      } catch (err) {
        logger.warn({ err }, 'persist: LONGA falhou')
      }
    }

    // EPISÓDICA — resume a execução (precisa de LLM)
    if (episodic && memoryLlm) {
      try {
        const res = await memoryLlm.generateStructured(
          getSummarizeRunSystemPrompt(),
          getSummarizeRunUserPrompt(transcript),
          SummarySchema,
        )
        if (res.success) await episodic.store(scopeId, runId, res.data.summary)
      } catch (err) {
        logger.warn({ err }, 'persist: EPISÓDICA falhou')
      }
    }

    // CONTEXTUAL — indexa a resposta final como fragmento buscável
    if (contextual && answer) {
      try {
        await contextual.index(runId, answer, { scopeId, metadata: { question } })
      } catch (err) {
        logger.warn({ err }, 'persist: CONTEXTUAL falhou')
      }
    }

    return {} // escrita não altera o state
  }
}
