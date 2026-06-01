// persist node — fase "persistir". Plan-execute grava só LONGA (fatos) + EPISÓDICA (resumo).
// Sem reflexão evolutiva / lição (isso é p/ react e reflection); sem CONTEXTUAL.
import type { LongTermMemoryService, EpisodicMemoryService } from '@harness/memory'
import type { OpenRouterService } from '../../services/openrouter.service.js'
import type { AgentState } from '../graph.js'
import { logger } from '../../utils/logger.js'
import { FactsSchema, getExtractFactsSystemPrompt, getExtractFactsUserPrompt } from '../../prompts/v1/extract-facts.prompt.js'
import { SummarySchema, getSummarizeRunSystemPrompt, getSummarizeRunUserPrompt } from '../../prompts/v1/summarize-run.prompt.js'

interface PersistDeps {
  memoryLlm: OpenRouterService | null
  longTerm: LongTermMemoryService | null
  episodic: EpisodicMemoryService | null
}

type SubResult = { tool: string; args: Record<string, unknown>; result: unknown }

function buildTranscript(question: string, subResults: SubResult[], answer: string): string {
  const steps = subResults.map((s) => `${s.tool}(${JSON.stringify(s.args)}) → ${JSON.stringify(s.result)}`).join('\n')
  return `Pergunta: ${question}\nPassos:\n${steps}\nResposta final: ${answer}`
}

export function makePersistNode(deps: PersistDeps) {
  const { memoryLlm, longTerm, episodic } = deps

  return async function persistNode(state: AgentState): Promise<Partial<AgentState>> {
    const scopeId = state.scopeId ?? 'global'
    const runId = state.runId ?? `run-${Date.now()}`
    const question = state.question ?? ''
    const answer = state.finalAnswer ?? ''
    const subResults = (state.subResults ?? []) as SubResult[]
    const transcript = buildTranscript(question, subResults, answer)

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
    }

    return {}
  }
}
