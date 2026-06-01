// Entrypoint de eval do preset react.
// Liga o runner genérico do harness ao grafo ReAct via InvokeAgent (P2 DI).
//
// Roda: npm run eval  (ou: tsx --env-file=.env evals/run.ts [contrato.yaml])
import { resolve } from 'node:path'
import { HumanMessage, AIMessage, ToolMessage } from '@langchain/core/messages'
import type { BaseMessage } from '@langchain/core/messages'
import { runContract, type InvokeAgent } from '@harness/harness'
import type { RunResult } from '@harness/harness'
import { buildAgent } from '../src/agent/factory.js'

const agent = buildAgent()

// Normaliza uma execução do grafo ReAct no RunResult que o evaluate espera.
const invokeAgent: InvokeAgent = async (input, callbacks) => {
  const result = await agent.invoke(
    { question: input, messages: [new HumanMessage(input)] },
    { callbacks: callbacks as never },
  )

  const messages = (result.messages ?? []) as BaseMessage[]

  // tool calls: varre as AIMessages buscando tool_calls
  const toolCalls = messages
    .filter((m): m is AIMessage => m instanceof AIMessage)
    .flatMap((m) =>
      (m.tool_calls ?? []).map((tc) => ({ name: tc.name, params: tc.args as Record<string, unknown> })),
    )

  // reasoning: texto das AIMessages + observações das ToolMessages
  const reasoningText = messages
    .filter((m: BaseMessage) => m instanceof AIMessage || m instanceof ToolMessage)
    .map((m: BaseMessage) => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content)))
    .join('\n')

  const run: RunResult = {
    toolCalls,
    reasoningText,
    output: result.finalAnswer ?? '',
  }

  return { run } // traceId vem do handler Langfuse; opcional aqui
}

const contract = process.argv[2]
  ? resolve(process.argv[2])
  : resolve(import.meta.dirname, '../../../../packages/harness/src/contracts/buscar_produto.yaml')

await runContract(contract, invokeAgent)
