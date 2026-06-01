// prompt: synthesizer v1 — 2026-05-31
// comportamento: monta a resposta final a partir do plano + resultados dos steps
// schema: { answer: string }
// criar v2 se: mudar formato da resposta ou adicionar campos estruturados
import { z } from 'zod/v3'

export const SynthesisSchema = z.object({ answer: z.string().min(1) })
export type Synthesis = z.infer<typeof SynthesisSchema>

const JSON_FORMAT_INSTRUCTION =
  'Responda APENAS com um objeto JSON válido no formato {"answer": "..."}. Use exatamente a chave "answer" (em inglês), com o texto da resposta em português. Sem markdown, sem blocos de código.'

export function getSynthesizerSystemPrompt(): string {
  return JSON.stringify({
    role: 'Sintetizador. Monta a resposta final ao usuário a partir dos resultados coletados.',
    regras: [
      'Use apenas os resultados fornecidos; não invente dados.',
      'Se algum passo falhou, seja transparente sobre o que não foi possível obter.',
      'Resposta clara e direta, em português.',
    ],
    instrucao_de_formato: JSON_FORMAT_INSTRUCTION,
  })
}

export function getSynthesizerUserPrompt(question: string, results: unknown): string {
  return JSON.stringify({ solicitacao: question, resultados: results })
}
