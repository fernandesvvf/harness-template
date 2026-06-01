// suite.schema — a eval suite (config declarativa de qualidade).
// Inspirada na aula13: amarra dataset + limiares. É o "contrato de qualidade":
// define O QUE medir e com QUE rigor (gate de CI).
//
// Schema-First no próprio gate: suite malformada falha antes de rodar.
import { z } from 'zod'

// Limiar por métrica: { metrica: { min?, max? } }. min = piso, max = teto.
const Limiar = z.object({
  min: z.number().optional(),
  max: z.number().optional(),
})

export const SuiteSchema = z.object({
  nome: z.string(),
  // caminho do dataset relativo à própria suite
  dataset: z.string(),
  // limiares por nome de métrica (score agregado 0..1 do dataset-runner)
  limiares: z.record(Limiar).default({}),
})

export type Suite = z.infer<typeof SuiteSchema>
export type LimiarT = z.infer<typeof Limiar>
