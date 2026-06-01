// prompt: consolidate-lessons v1 — 2026-05-31
// comportamento: detecta PADRÕES recorrentes em várias lições e consolida em fatos duráveis
// schema: { patterns: { key: string, value: string }[] }
// criar v2 se: mudar o critério de "padrão recorrente" ou o formato consolidado
import { z } from 'zod/v3'

// Reflexão evolutiva nível 2: padrões emergem do AGREGADO (regra da aula: ~a cada 10
// execuções). Lições pontuais → fatos consolidados (LONGA) quando se repetem.
export const PatternsSchema = z.object({
  patterns: z.array(z.object({ key: z.string(), value: z.string() })),
})
export type PatternsOutput = z.infer<typeof PatternsSchema>

const JSON_FORMAT_INSTRUCTION =
  'Responda APENAS com um objeto JSON válido, sem markdown, sem blocos de código. Apenas o JSON puro.'

export function getConsolidateSystemPrompt(): string {
  return JSON.stringify({
    role: 'Consolidador de aprendizado. Detecta padrões recorrentes em lições e os promove a regras duráveis.',
    regras: [
      'Só consolide um padrão se ele aparecer em MÚLTIPLAS lições (recorrência).',
      'Lição isolada/única NÃO vira padrão — ignore.',
      'key estável e curta; value = a regra consolidada, generalizável.',
      'Se nenhum padrão recorrente, retorne patterns: [].',
    ],
    instrucao_de_formato: JSON_FORMAT_INSTRUCTION,
  })
}

export function getConsolidateUserPrompt(lessons: string[]): string {
  return JSON.stringify({ licoes: lessons, instrucao: 'Detecte padrões recorrentes e consolide.' })
}
