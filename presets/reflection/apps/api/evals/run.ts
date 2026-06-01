// Entrypoint de eval do preset reflection.
// Liga o runner genérico do harness ao grafo via InvokeAgent (P2 DI).
//
// Roda: npm run eval  (ou: tsx --env-file=.env evals/run.ts [contrato.yaml])
import { resolve } from 'node:path'
import { runContract, type InvokeAgent } from '@harness/harness'
import type { RunResult } from '@harness/harness'
import { buildAgent } from '../src/agent/factory.js'

const agent = buildAgent()

const invokeAgent: InvokeAgent = async (input, callbacks) => {
  const result = await agent.invoke({ question: input }, { callbacks: callbacks as never })

  const run: RunResult = {
    toolCalls: [], // reflection não usa tools por padrão
    // reasoning = a crítica final (o "porquê" da qualidade está no critic)
    reasoningText: JSON.stringify({ critique: result.critique ?? '', iterations: result.iterations ?? 0 }),
    output: result.finalAnswer ?? result.draft ?? '',
  }

  return { run }
}

const contract = process.argv[2]
  ? resolve(process.argv[2])
  : resolve(import.meta.dirname, '../../../../packages/harness/src/contracts/buscar_produto.yaml')

await runContract(contract, invokeAgent)
