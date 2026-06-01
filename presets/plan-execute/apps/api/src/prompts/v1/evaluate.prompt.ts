// prompt: evaluate v1 — 2026-06-01
// comportamento: auto-avaliação leve da resposta final (fase "avaliar" do ciclo)
// schema: { score: number 0..1, ok: boolean, motivo: string }
// criar v2 se: mudar critérios de qualidade ou tornar a avaliação bloqueante
import { z } from 'zod/v3'

// Fase "avaliar" do ciclo (recuperar→perceber→planejar→agir→AVALIAR→persistir).
// Fail-open: registra qualidade, NUNCA bloqueia. score baixo vira sinal pro persist.
export const EvaluateSchema = z.object({
  score: z.number().min(0).max(1),
  ok: z.boolean(),
  motivo: z.string().optional(),
})
export type EvaluateOutput = z.infer<typeof EvaluateSchema>

const JSON_FORMAT_INSTRUCTION =
  'Responda APENAS com um objeto JSON válido, sem markdown, sem blocos de código. Apenas o JSON puro.'

export function getEvaluateSystemPrompt(): string {
  return JSON.stringify({
    role: 'Auto-avaliador. Dá uma nota objetiva à resposta antes de entregar.',
    criterios: ['Responde de fato a pergunta?', 'Está completa?', 'Sem erro interno exposto?'],
    escala: 'score 0..1; ok=true se score >= 0.6',
    instrucao_de_formato: JSON_FORMAT_INSTRUCTION,
  })
}

export function getEvaluateUserPrompt(question: string, answer: string): string {
  return JSON.stringify({ pergunta: question, resposta: answer })
}
