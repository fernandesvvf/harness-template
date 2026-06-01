// prompt: summarize-run v1 — 2026-05-31
// comportamento: resume a execução pra memória EPISÓDICA ("diário")
// schema: { summary: string }
// criar v2 se: mudar o nível de detalhe ou o foco do resumo
import { z } from 'zod/v3'

export const SummarySchema = z.object({ summary: z.string().min(1) })
export type SummaryOutput = z.infer<typeof SummarySchema>

const JSON_FORMAT_INSTRUCTION =
  'Responda APENAS com um objeto JSON válido no formato {"summary": "..."}. Use exatamente a chave "summary" (em inglês). Sem markdown, sem blocos de código.'

export function getSummarizeRunSystemPrompt(): string {
  return JSON.stringify({
    role: 'Resumidor de execuções. Cria um resumo curto e útil do que aconteceu.',
    regras: [
      'Foque no que foi pedido, no que foi feito e no resultado.',
      '1-3 frases. Sem detalhes irrelevantes.',
      'Escreva de forma que ajude uma execução futura semelhante.',
    ],
    instrucao_de_formato: JSON_FORMAT_INSTRUCTION,
  })
}

export function getSummarizeRunUserPrompt(transcript: string): string {
  return JSON.stringify({ execucao: transcript, instrucao: 'Resuma esta execução.' })
}
