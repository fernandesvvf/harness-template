// Entrypoint de eval do preset plan-execute.
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

  const subResults = (result.subResults ?? []) as { tool: string; args: Record<string, unknown>; result: unknown }[]

  const run: RunResult = {
    // tool calls = steps executados do plano
    toolCalls: subResults.map((s) => ({ name: s.tool, params: s.args })),
    // reasoning = o plano + resultados (o "raciocínio" do plan-execute está no plano)
    reasoningText: JSON.stringify({ plan: result.plan ?? [], subResults }),
    output: result.finalAnswer ?? '',
  }

  return { run }
}

const contract = process.argv[2]
  ? resolve(process.argv[2])
  : resolve(import.meta.dirname, '../../../../packages/harness/src/contracts/buscar_produto.yaml')

await runContract(contract, invokeAgent)
