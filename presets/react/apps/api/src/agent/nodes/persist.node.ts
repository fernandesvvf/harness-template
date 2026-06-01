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
import { LessonSchema, getExtractLessonSystemPrompt, getExtractLessonUserPrompt } from '../../prompts/v1/extract-lesson.prompt.js'

interface PersistDeps {
  memoryLlm: OpenRouterService | null
  longTerm: LongTermMemoryService | null
  episodic: EpisodicMemoryService | null
  contextual: ContextualMemoryService | null
  /** teto de steps do ReAct — usado pra detectar "resultado inesperado". */
  maxSteps: number
}

function buildTranscript(messages: BaseMessage[], question: string, answer: string): string {
  const turns = messages
    .filter((m) => m instanceof AIMessage || m instanceof ToolMessage)
    .map((m) => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content)))
    .join('\n')
  return `Pergunta: ${question}\n${turns}\nResposta final: ${answer}`
}

/**
 * Detecta "resultado inesperado" por sinais do próprio run (sem LLM extra).
 * Reflexão evolutiva só extrai lição quando há surpresa (regra da aula).
 * Retorna o sinal (string) ou null se a execução foi normal.
 */
function detectSurprise(
  messages: BaseMessage[],
  stepCount: number,
  maxSteps: number,
  evalOk: boolean | undefined,
): string | null {
  // sinal 1: alguma tool retornou erro
  const toolError = messages.some(
    (m) => m instanceof ToolMessage && typeof m.content === 'string' && /erro|error|falha|not found|não encontrad/i.test(m.content),
  )
  if (toolError) return 'tool retornou erro'

  // sinal 2: loop atingiu o teto de passos (não convergiu)
  if (stepCount >= maxSteps) return 'atingiu o teto de passos sem convergir'

  // sinal 3: a fase avaliar reprovou a resposta (evalOk=false)
  if (evalOk === false) return 'auto-avaliação reprovou a resposta'

  return null
}

export function makePersistNode(deps: PersistDeps) {
  const { memoryLlm, longTerm, episodic, contextual, maxSteps } = deps

  return async function persistNode(state: AgentState): Promise<Partial<AgentState>> {
    const scopeId = state.scopeId ?? 'global'
    const runId = state.runId ?? `run-${Date.now()}`
    const question = state.question ?? ''
    const answer = state.finalAnswer ?? ''
    const msgs = (state.messages ?? []) as BaseMessage[]
    const transcript = buildTranscript(msgs, question, answer)

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
        if (res.success) await episodic.store(scopeId, runId, res.data.summary, 'summary')
      } catch (err) {
        logger.warn({ err }, 'persist: EPISÓDICA falhou')
      }
    }

    // REFLEXÃO EVOLUTIVA (nível 1) — lição SÓ quando o resultado foi inesperado.
    // Sinal vem do próprio run (erro de tool / teto de passos), sem LLM extra.
    // A lição é generalizável (regra da aula) e guardada como kind='lesson'.
    if (episodic && memoryLlm) {
      const surprise = detectSurprise(msgs, state.stepCount ?? 0, maxSteps, state.evalOk)
      if (surprise) {
        try {
          const res = await memoryLlm.generateStructured(
            getExtractLessonSystemPrompt(),
            getExtractLessonUserPrompt(transcript, surprise),
            LessonSchema,
          )
          if (res.success && res.data.lesson) {
            await episodic.store(scopeId, runId, res.data.lesson, 'lesson')
            logger.info({ surprise, lesson: res.data.lesson }, 'persist: lição aprendida')
          }
        } catch (err) {
          logger.warn({ err }, 'persist: extração de lição falhou')
        }
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
