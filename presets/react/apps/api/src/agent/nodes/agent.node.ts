// agent node — o "Raciocinar" do ReAct.
// LLM com tools vinculadas decide: chamar tool(s) OU dar resposta final.
// Retorna a AIMessage (pode conter tool_calls) — o reducer do state acumula.
import { SystemMessage, AIMessage } from '@langchain/core/messages'
import type { BaseMessage } from '@langchain/core/messages'
import type { StructuredToolInterface } from '@langchain/core/tools'
import { type OpenRouterService, recordUsage } from '../../services/openrouter.service.js'
import type { AgentState } from '../graph.js'
import { logger } from '../../utils/logger.js'
import { getAgentSystemPrompt } from '../../prompts/v1/agent.prompt.js'

// DI: recebe o serviço LLM e as tools por parâmetro (P2). Nada instanciado aqui.
export function makeAgentNode(llm: OpenRouterService, tools: StructuredToolInterface[]) {
  // .chat expõe o ChatOpenAI cru pra bindTools (necessário no ReAct).
  const model = llm.chat.bindTools(tools)

  return async function agentNode(state: AgentState): Promise<Partial<AgentState>> {
    const history = state.messages ?? []
    const messages: BaseMessage[] = [
      new SystemMessage(getAgentSystemPrompt(state.memoryContext)),
      ...history,
    ]
    const stepCount = (state.stepCount ?? 0) + 1

    try {
      const ai = (await model.invoke(messages)) as AIMessage
      recordUsage(ai)
      const hasToolCalls = (ai.tool_calls ?? []).length > 0

      // Sem tool_calls = resposta final. Captura o texto pra finalAnswer (facilita eval).
      const finalAnswer = hasToolCalls
        ? undefined
        : typeof ai.content === 'string'
          ? ai.content
          : JSON.stringify(ai.content)

      logger.info({ stepCount, hasToolCalls }, 'agent: iteração')
      return {
        messages: [ai],
        stepCount,
        ...(finalAnswer !== undefined ? { finalAnswer } : {}),
      }
    } catch (err) {
      // Graceful Degradation (P9): erro do LLM encerra com mensagem amigável.
      logger.error({ err, stepCount }, 'agent node falhou')
      return {
        messages: [new AIMessage('Desculpe, não consegui processar sua solicitação agora.')],
        stepCount,
        finalAnswer: 'Desculpe, não consegui processar sua solicitação agora.',
      }
    }
  }
}
