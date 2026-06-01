// Reflexão evolutiva — NÍVEL 2 (batch). Roda manualmente, a cada ~N execuções.
// Varre as lições (EPISÓDICA kind=lesson) do scope, detecta PADRÕES recorrentes
// e promove a fatos duráveis (LONGA). Padrões emergem do agregado, não de 1 run.
//
// Roda: tsx --env-file=.env scripts/consolidate-lessons.ts [scopeId]
import {
  loadMemoryContract,
  EpisodicMemoryService,
  LongTermMemoryService,
  closePool,
} from '@harness/memory'
import { resolve } from 'node:path'
import { OpenRouterService } from '../src/services/openrouter.service.js'
import { config } from '../src/config.js'
import {
  PatternsSchema,
  getConsolidateSystemPrompt,
  getConsolidateUserPrompt,
} from '../src/prompts/v1/consolidate-lessons.prompt.js'

const scopeId = process.argv[2] ?? 'global'

const contract = loadMemoryContract(resolve(process.cwd(), 'memory.md'))
if (!contract.memorias.episodica.enabled || !contract.memorias.longa.enabled) {
  console.error('consolidate-lessons requer EPISÓDICA e LONGA enabled no memory.md')
  process.exit(1)
}

const episodic = new EpisodicMemoryService(contract.memorias.episodica.ttl_dias)
const longTerm = new LongTermMemoryService()
const llm = new OpenRouterService(config.models.memory)

const lessons = await episodic.getAllLessons(scopeId)
console.log(`${lessons.length} lição(ões) no scope "${scopeId}"`)

if (lessons.length === 0) {
  console.log('nada a consolidar.')
  await closePool()
  process.exit(0)
}

const res = await llm.generateStructured(
  getConsolidateSystemPrompt(),
  getConsolidateUserPrompt(lessons.map((l) => l.summary)),
  PatternsSchema,
)

if (!res.success) {
  console.error('consolidação falhou:', res.error)
  await closePool()
  process.exit(1)
}

for (const p of res.data.patterns) {
  await longTerm.upsert(scopeId, `padrao:${p.key}`, p.value)
  console.log(`padrão consolidado → LONGA: ${p.key} = ${p.value}`)
}

console.log(`${res.data.patterns.length} padrão(ões) promovido(s) a fatos duráveis.`)
await closePool()
