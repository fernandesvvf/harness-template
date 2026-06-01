// persist node — fase "persistir". Reflection grava LONGA + EPISÓDICA + CONTEXTUAL.
// Reflexão evolutiva forte aqui: surpresa = critic NÃO aprovou (reprovou até o teto).
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
import { LessonSchema, getExtractLessonSystemPrompt, getExtractLessonUserPrompt } from '../../prompts/v1/extract-lesson.prompt.js'

interface PersistDeps {
  memoryLlm: OpenRouterService | null
  longTerm: LongTermMemoryService | null
  episodic: EpisodicMemoryService | null
  contextual: ContextualMemoryService | null
}

function buildTranscript(question: string, draft: string, critique: string | undefined, answer: string): string {
  return `Pergunta: ${question}\nRascunho final: ${draft}\nÚltima crítica: ${critique ?? '(aprovado)'}\nResposta: ${answer}`
}

/** Surpresa no Reflection: o critic NÃO aprovou (entregou no teto sem aprovação). */
function detectSurprise(approved: boolean | undefined): string | null {
  if (approved === false) return 'critic não aprovou a resposta até o teto de iterações'
  return null
}

export function makePersistNode(deps: PersistDeps) {
  const { memoryLlm, longTerm, episodic, contextual } = deps

  return async function persistNode(state: AgentState): Promise<Partial<AgentState>> {
    const scopeId = state.scopeId ?? 'global'
    const runId = state.runId ?? `run-${Date.now()}`
    const question = state.question ?? ''
    const answer = state.finalAnswer ?? state.draft ?? ''
    const transcript = buildTranscript(question, state.draft ?? '', state.critique, answer)

    if (longTerm && memoryLlm) {
      try {
        const res = await memoryLlm.generateStructured(getExtractFactsSystemPrompt(), getExtractFactsUserPrompt(transcript), FactsSchema)
        if (res.success) for (const f of res.data.facts) await longTerm.upsert(scopeId, f.key, f.value)
      } catch (err) {
        logger.warn({ err }, 'persist: LONGA falhou')
      }
    }

    if (episodic && memoryLlm) {
      try {
        const res = await memoryLlm.generateStructured(getSummarizeRunSystemPrompt(), getSummarizeRunUserPrompt(transcript), SummarySchema)
        if (res.success) await episodic.store(scopeId, runId, res.data.summary, 'summary')
      } catch (err) {
        logger.warn({ err }, 'persist: EPISÓDICA falhou')
      }

      // Reflexão evolutiva: se o critic reprovou até o fim, aprende a lição.
      const surprise = detectSurprise(state.approved)
      if (surprise) {
        try {
          const res = await memoryLlm.generateStructured(getExtractLessonSystemPrompt(), getExtractLessonUserPrompt(transcript, surprise), LessonSchema)
          if (res.success && res.data.lesson) {
            await episodic.store(scopeId, runId, res.data.lesson, 'lesson')
            logger.info({ surprise, lesson: res.data.lesson }, 'persist: lição aprendida')
          }
        } catch (err) {
          logger.warn({ err }, 'persist: extração de lição falhou')
        }
      }
    }

    if (contextual && answer) {
      try {
        await contextual.index(runId, answer, { scopeId, metadata: { question } })
      } catch (err) {
        logger.warn({ err }, 'persist: CONTEXTUAL falhou')
      }
    }

    return {}
  }
}
