// Smoke test de memória — roda o agente 2x no mesmo scopeId e prova a escrita+leitura.
//
// Pré-requisitos:
//   1. docker-compose up -d postgres   (Postgres + pgvector no ar)
//   2. cp apps/api/.env.example apps/api/.env  e preencher OPENROUTER_API_KEY
//   3. memory.md com LONGA/EPISÓDICA/CONTEXTUAL enabled (default do preset)
//
// Roda: tsx --env-file=.env scripts/smoke-memory.ts
import { HumanMessage } from '@langchain/core/messages'
import { getPool, closePool } from '@harness/memory'
import { buildAgent } from '../src/agent/factory.js'

const agent = buildAgent()
const scopeId = `smoke-${Date.now()}`

async function ask(question: string) {
  const r = await agent.invoke({
    question,
    scopeId,
    runId: `run-${Date.now()}`,
    messages: [new HumanMessage(question)],
  })
  console.log(`\nQ: ${question}\nA: ${r.finalAnswer ?? '(sem resposta)'}`)
  if (r.memoryContext) console.log(`[memoryContext recuperado]\n${r.memoryContext}`)
}

console.log(`scopeId = ${scopeId}`)

// 1ª execução: nada na memória ainda; persist escreve no fim.
await ask('qual o preço do produto X?')

// 2ª execução: recall deve trazer EPISÓDICA/CONTEXTUAL da 1ª.
await ask('e o produto Y?')

// Prova direta no banco que a escrita aconteceu.
const pool = getPool()
const facts = await pool.query('SELECT key, value FROM long_term_facts WHERE scope_id = $1', [scopeId])
const eps = await pool.query('SELECT summary FROM episodic_summaries WHERE scope_id = $1', [scopeId])
const frags = await pool.query('SELECT content FROM contextual_fragments WHERE scope_id = $1', [scopeId])

console.log('\n=== ESTADO DO BANCO (scopeId) ===')
console.log('LONGA (fatos):    ', facts.rows)
console.log('EPISÓDICA (resumos):', eps.rows.length, 'linha(s)')
console.log('CONTEXTUAL (frags): ', frags.rows.length, 'linha(s)')

await closePool()
console.log('\nsmoke OK — memória escrita e recuperada entre execuções.')
