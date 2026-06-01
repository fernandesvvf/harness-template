// INFRA — não mudar. Cliente LLM com fallback automático.
// Idêntico ao template antigo (PATTERNS: Strategy via generateStructured<T>).
import { ChatOpenAI } from '@langchain/openai'
import { SystemMessage, HumanMessage } from '@langchain/core/messages'
import type { z } from 'zod/v3'
import { recordTokens } from '@harness/harness'
import { config } from '../config.js'
import { logger } from '../utils/logger.js'

/** Reporta o usage de uma resposta LLM ao token-meter (benchmark de custo). */
function recordUsage(response: { usage_metadata?: { input_tokens?: number; output_tokens?: number } }): void {
  const u = response.usage_metadata
  if (u) recordTokens(u.input_tokens ?? 0, u.output_tokens ?? 0)
}

function makeClient(modelName: string): ChatOpenAI {
  return new ChatOpenAI({
    apiKey: config.openrouter.apiKey,
    modelName,
    temperature: config.openrouter.temperature,
    maxRetries: config.openrouter.maxRetries,
    configuration: {
      baseURL: config.openrouter.baseUrl,
      defaultHeaders: {
        'HTTP-Referer': config.openrouter.httpReferer,
        'X-Title': config.openrouter.xTitle,
      },
    },
  })
}

export class OpenRouterService {
  private readonly primaryClient: ChatOpenAI
  private readonly fallbackClient: ChatOpenAI
  readonly modelName: string

  constructor(modelName: string) {
    this.modelName = modelName
    this.primaryClient = makeClient(modelName)
    this.fallbackClient = modelName === config.openrouter.fallbackModel
      ? this.primaryClient
      : makeClient(config.openrouter.fallbackModel)
  }

  /** Expõe o ChatOpenAI cru — necessário pro ReAct (bindTools + tool calls). */
  get chat(): ChatOpenAI {
    return this.primaryClient
  }

  async generateStructured<T>(
    systemPrompt: string,
    userPrompt: string,
    schema: z.ZodSchema<T>,
  ): Promise<{ success: true; data: T } | { success: false; error: string }> {
    const messages = [new SystemMessage(systemPrompt), new HumanMessage(userPrompt)]

    const clients = this.primaryClient === this.fallbackClient
      ? [{ client: this.primaryClient, name: this.modelName }]
      : [
          { client: this.primaryClient, name: this.modelName },
          { client: this.fallbackClient, name: config.openrouter.fallbackModel },
        ]

    for (const { client, name } of clients) {
      try {
        const response = await client.invoke(messages)
        recordUsage(response)
        const raw = typeof response.content === 'string'
          ? response.content.trim()
          : JSON.stringify(response.content)
        const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()

        let parsed: unknown
        try {
          parsed = JSON.parse(cleaned)
        } catch {
          logger.warn({ raw: cleaned, modelName: name }, 'OpenRouter: resposta não é JSON válido')
          return { success: false, error: `Resposta não é JSON válido: ${cleaned.slice(0, config.openrouter.logSnippetLength)}` }
        }

        const validated = schema.safeParse(parsed)
        if (!validated.success) {
          logger.warn({ parsed, errors: validated.error.flatten(), modelName: name }, 'OpenRouter: JSON não passou no schema Zod')
          return { success: false, error: `Schema inválido: ${validated.error.message}` }
        }

        if (name !== this.modelName) {
          logger.info({ primary: this.modelName, fallback: name }, 'OpenRouter: usando modelo fallback')
        }
        return { success: true, data: validated.data }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        const isRateLimit = message.includes('429') || message.includes('rate')
        if (isRateLimit && name === this.modelName && clients.length > 1) {
          logger.warn({ modelName: name, fallback: config.openrouter.fallbackModel }, 'OpenRouter: rate limit — tentando fallback')
          continue
        }
        logger.error({ error, modelName: name }, 'OpenRouter generateStructured falhou')
        return { success: false, error: message }
      }
    }
    return { success: false, error: 'Todos os modelos falharam' }
  }
}
