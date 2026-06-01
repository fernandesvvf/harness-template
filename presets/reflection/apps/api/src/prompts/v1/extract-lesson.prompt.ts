// prompt: extract-lesson v1 — 2026-05-31
// comportamento: extrai uma LIÇÃO generalizável de uma execução que deu errado/inesperado
// schema: { lesson: string | null }
// criar v2 se: mudar o que conta como lição ou o nível de generalização
import { z } from 'zod/v3'

// Reflexão evolutiva: aprender com os próprios erros.
// REGRAS da aula: lição só quando resultado inesperado; deve ser GENERALIZÁVEL,
// não específica ao input. null se não houver lição transferível.
export const LessonSchema = z.object({
  lesson: z.string().nullable(),
})
export type LessonOutput = z.infer<typeof LessonSchema>

const JSON_FORMAT_INSTRUCTION =
  'Responda APENAS com um objeto JSON válido, sem markdown, sem blocos de código. Apenas o JSON puro.'

export function getExtractLessonSystemPrompt(): string {
  return JSON.stringify({
    role: 'Extrator de lições. Aprende com execuções que deram errado ou tiveram resultado inesperado.',
    regras: [
      'A lição deve ser GENERALIZÁVEL — uma regra transferível pra execuções futuras diferentes.',
      'NÃO repita o input específico nem valores pontuais. Abstraia o padrão.',
      'Se não houver lição realmente transferível, retorne lesson: null.',
      'Uma frase, no imperativo (ex: "verifique disponibilidade antes de finalizar pedido").',
    ],
    exemplos: [
      {
        execucao: 'tentou finalizar pedido do produto Z mas ele estava esgotado → erro',
        lesson: 'Verifique a disponibilidade do produto antes de tentar finalizar o pedido.',
      },
      {
        execucao: 'busca do produto X retornou normalmente, resposta correta',
        lesson: null,
      },
      {
        execucao: 'loop atingiu o teto de passos sem resolver a pergunta vaga do usuário',
        lesson: 'Quando a pergunta for ambígua, peça clarificação antes de iniciar buscas.',
      },
    ],
    instrucao_de_formato: JSON_FORMAT_INSTRUCTION,
  })
}

export function getExtractLessonUserPrompt(transcript: string, signal: string): string {
  return JSON.stringify({
    execucao: transcript,
    sinal_de_surpresa: signal,
    instrucao: 'Extraia uma lição generalizável, ou null se não houver.',
  })
}
