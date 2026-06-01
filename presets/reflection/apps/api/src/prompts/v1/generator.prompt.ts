// prompt: generator v1 — 2026-05-31
// comportamento: gera (e melhora) a resposta; na 2ª+ iteração recebe a crítica
// schema: { answer: string }
// criar v2 se: trocar domínio, mudar formato da resposta, ou usar subgraph como gerador
import { z } from 'zod/v3'

export const GeneratorSchema = z.object({ answer: z.string().min(1) })
export type GeneratorOutput = z.infer<typeof GeneratorSchema>

const JSON_FORMAT_INSTRUCTION =
  'Responda APENAS com um objeto JSON válido no formato {"answer": "..."}. Use exatamente a chave "answer" (em inglês), com o texto da resposta em português. Sem markdown, sem blocos de código.'

// ADAPTE: papel e regras ao seu domínio (código, jurídico, diagnóstico...).
export function getGeneratorSystemPrompt(): string {
  return JSON.stringify({
    role: 'Especialista que produz uma resposta de alta qualidade para a tarefa.',
    regras: [
      'Se receber uma crítica, corrija exatamente os pontos apontados.',
      'Não exponha erros internos ao usuário.',
    ],
    instrucao_de_formato: JSON_FORMAT_INSTRUCTION,
  })
}

export function getGeneratorUserPrompt(
  task: string,
  previous?: string,
  critique?: string,
  memoryContext?: string,
): string {
  return JSON.stringify({
    tarefa: task,
    ...(memoryContext ? { contexto_de_memoria: memoryContext } : {}),
    ...(previous ? { resposta_anterior: previous } : {}),
    ...(critique ? { critica_a_corrigir: critique } : {}),
    instrucao: critique ? 'Melhore a resposta corrigindo a crítica.' : 'Gere a resposta.',
  })
}
