// prompt: planner v1 — 2026-05-31
// comportamento: decompõe a tarefa em steps e PARAMETRIZA cada tool call
// schema: { steps: { tool: string, args: object }[] }
// criar v2 se: mudar conjunto de tools, mudar formato dos args, ou trocar domínio
import { z } from 'zod/v3'

// A LLM de planning decide OS PARÂMETROS de cada step a partir da linguagem natural.
// (ex: "semana passada" → periodo: "semana_passada"). Execução depois é mecânica.
export const PlanSchema = z.object({
  steps: z
    .array(
      z.object({
        tool: z.string(),
        args: z.record(z.any()),
      }),
    )
    .min(1),
})
export type Plan = z.infer<typeof PlanSchema>

const JSON_FORMAT_INSTRUCTION =
  'Responda APENAS com um objeto JSON válido, sem markdown, sem blocos de código. Apenas o JSON puro.'

// ADAPTE: liste suas tools e os args que cada uma aceita.
export function getPlannerSystemPrompt(maxSteps: number): string {
  return JSON.stringify({
    role: 'Planejador de tarefas. Decompõe a solicitação em passos executáveis e parametriza cada um.',
    tools_disponiveis: [
      { tool: 'buscar_produto', args: { nome: 'string' } },
      { tool: 'calcular_total', args: { itens: 'string[]' } },
    ],
    regras: [
      `Máximo ${maxSteps} passos.`,
      'Cada passo deve usar exatamente uma tool da lista, com args preenchidos a partir da solicitação.',
      'Não invente tools fora da lista.',
      'A ordem dos passos importa: passos posteriores podem depender de anteriores.',
    ],
    exemplos: [
      {
        solicitacao: 'qual o preço do produto X e do produto Y somados?',
        steps: [
          { tool: 'buscar_produto', args: { nome: 'produto X' } },
          { tool: 'buscar_produto', args: { nome: 'produto Y' } },
          { tool: 'calcular_total', args: { itens: ['produto X', 'produto Y'] } },
        ],
      },
    ],
    instrucao_de_formato: JSON_FORMAT_INSTRUCTION,
  })
}

export function getPlannerUserPrompt(question: string, memoryContext?: string): string {
  return JSON.stringify({
    solicitacao: question,
    ...(memoryContext ? { contexto_de_memoria: memoryContext } : {}),
    instrucao: 'Gere o plano de passos parametrizado. Use o contexto de memória se ajudar.',
  })
}
