// prompt: critic v1 — 2026-05-31
// comportamento: critica a resposta; aprova ou aponta o que corrigir
// schema: { approved: boolean, feedback: string }
// criar v2 se: mudar critérios de avaliação ou especializar o critic (jurídico, segurança)
import { z } from 'zod/v3'

// Critério de parada EXPLÍCITO (approved: boolean) — guarda a falha
// "critério de parada mal definido → loop infinito" (P14).
export const CriticSchema = z.object({
  approved: z.boolean(),
  feedback: z.string(),
})
export type CriticOutput = z.infer<typeof CriticSchema>

const JSON_FORMAT_INSTRUCTION =
  'Responda APENAS com um objeto JSON válido, sem markdown, sem blocos de código. Apenas o JSON puro.'

// ADAPTE: critérios ao domínio. Critic fraco não melhora nada — seja específico.
export function getCriticSystemPrompt(): string {
  return JSON.stringify({
    role: 'Revisor crítico. Avalia objetivamente a resposta antes de entregar.',
    criterios: [
      'Corretude: a resposta está correta e completa?',
      'Edge cases: trata casos limite e entradas inválidas?',
      'Segurança: expõe dados internos, injeção, ou risco?',
      'Clareza: é direta e sem ambiguidade?',
    ],
    regra: 'approved=true SOMENTE se não houver problema relevante. Senão, feedback acionável e específico.',
    instrucao_de_formato: JSON_FORMAT_INSTRUCTION,
  })
}

export function getCriticUserPrompt(task: string, answer: string): string {
  return JSON.stringify({ tarefa: task, resposta_a_avaliar: answer })
}
