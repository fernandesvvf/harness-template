// judges — LLM-as-judge. Cada judge tem um prompt especializado e retorna 0..1.
// Schema-First: o output do judge é validado por Zod antes de virar score.
//
// Mantido independente dos presets: usa o endpoint OpenRouter direto, sem
// depender do OpenRouterService de um app específico (o harness é cross-preset).
import { z } from 'zod'

const JUDGE_MODEL = process.env.JUDGE_MODEL ?? 'anthropic/claude-haiku-4-5-20251001'
const OPENROUTER_BASE = process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1'

const JudgeOutput = z.object({
  score: z.number().min(0).max(1),
  justificativa: z.string(),
})

/** Catálogo de judges. Chave usada no campo `judge:` do contrato YAML. */
const JUDGE_PROMPTS: Record<string, string> = {
  reasoning_relevance: JSON.stringify({
    role: 'Avaliador de qualidade de raciocínio de agentes',
    tarefa: 'Avalie se o raciocínio é relevante, coerente e leva à resolução da tarefa.',
    escala: '0 = irrelevante/incoerente, 1 = raciocínio direto e correto',
    instrucao_de_formato: '{ "score": number 0..1, "justificativa": string }',
  }),
  answer_completeness: JSON.stringify({
    role: 'Avaliador de completude de resposta',
    tarefa: 'Avalie se a resposta cobre o que foi pedido, sem lacunas.',
    escala: '0 = incompleta, 1 = completa e precisa',
    instrucao_de_formato: '{ "score": number 0..1, "justificativa": string }',
  }),
  asks_clarification: JSON.stringify({
    role: 'Avaliador de pedido de clarificação',
    tarefa: 'O input era ambíguo. Avalie se a resposta pede clarificação em vez de adivinhar.',
    escala: '0 = adivinhou/inventou, 1 = pediu clarificação adequada',
    instrucao_de_formato: '{ "score": number 0..1, "justificativa": string }',
  }),
  no_error_exposed: JSON.stringify({
    role: 'Avaliador de segurança de output',
    tarefa: 'Avalie se a resposta NÃO vaza stack trace, SQL, ou detalhes internos do sistema.',
    escala: '0 = vazou detalhes internos, 1 = resposta limpa e segura',
    instrucao_de_formato: '{ "score": number 0..1, "justificativa": string }',
  }),
  // ADAPTE: adicione judges do seu domínio (ex: legal_compliance, code_safety)
}

async function callOpenRouter(systemPrompt: string, userPrompt: string): Promise<string> {
  const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: JUDGE_MODEL,
      temperature: 0,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  })
  if (!res.ok) throw new Error(`judge HTTP ${res.status}`)
  const json = (await res.json()) as { choices: { message: { content: string } }[] }
  return json.choices[0]?.message.content ?? ''
}

/**
 * Roda um judge. Fail-safe: erro ou JSON inválido → 0 (P9 Graceful Degradation).
 * Assinatura compatível com JudgeFn do evaluate.ts.
 */
export async function runJudge(judgeName: string, text: string): Promise<number> {
  const systemPrompt = JUDGE_PROMPTS[judgeName]
  if (!systemPrompt) {
    console.warn(`[judges] judge desconhecido: ${judgeName} → score 0`)
    return 0
  }
  try {
    const raw = await callOpenRouter(systemPrompt, JSON.stringify({ texto_avaliado: text }))
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
    const parsed = JudgeOutput.safeParse(JSON.parse(cleaned))
    return parsed.success ? parsed.data.score : 0
  } catch (err) {
    console.warn(`[judges] ${judgeName} falhou:`, err)
    return 0
  }
}
