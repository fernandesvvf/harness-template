// prompt: extract-facts v1 — 2026-05-31
// comportamento: decide o que da execução vira FATO durável (LONGA)
// schema: { facts: { key: string, value: string }[] }
// criar v2 se: mudar o que conta como fato, ou o formato key/value
import { z } from 'zod/v3'

// Schema-First: o que vira fato é validado. Evita poluir LONGA com ruído (PERIGOSA).
export const FactsSchema = z.object({
  facts: z.array(z.object({ key: z.string(), value: z.string() })),
})
export type FactsOutput = z.infer<typeof FactsSchema>

const JSON_FORMAT_INSTRUCTION =
  'Responda APENAS com um objeto JSON válido, sem markdown, sem blocos de código. Apenas o JSON puro.'

// ADAPTE: o que é "fato durável" no seu domínio.
export function getExtractFactsSystemPrompt(): string {
  return JSON.stringify({
    role: 'Extrator de fatos duráveis. Decide o que de uma execução merece ser lembrado a longo prazo.',
    regras: [
      'Extraia apenas fatos estáveis e reutilizáveis (preferências, restrições, identidade, configurações confirmadas).',
      'NÃO extraia dados efêmeros, valores de uma consulta pontual, nem ruído conversacional.',
      'key curta e estável (ex: "produto_favorito"); value conciso.',
      'Se nada for durável, retorne facts: [].',
    ],
    exemplos: [
      {
        execucao: 'usuário disse que sempre compra em quantidade de 10 unidades',
        facts: [{ key: 'quantidade_padrao', value: '10 unidades' }],
      },
      {
        execucao: 'usuário perguntou o preço do produto X (resposta: R$199)',
        facts: [],
      },
    ],
    instrucao_de_formato: JSON_FORMAT_INSTRUCTION,
  })
}

export function getExtractFactsUserPrompt(transcript: string): string {
  return JSON.stringify({ execucao: transcript, instrucao: 'Extraia os fatos duráveis.' })
}
