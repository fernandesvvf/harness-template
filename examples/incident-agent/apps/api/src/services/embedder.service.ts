// INFRA — provedor de embedding via OpenRouter (compatível OpenAI /embeddings).
// Expõe uma fn Embedder pra injetar no ContextualMemoryService (DI).
import type { Embedder } from '@harness/memory'
import { config } from '../config.js'
import { logger } from '../utils/logger.js'

export function makeEmbedder(): Embedder {
  return async function embed(text: string): Promise<number[]> {
    const res = await fetch(`${config.openrouter.baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.openrouter.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: config.memory.embeddingModel, input: text }),
    })
    if (!res.ok) {
      logger.error({ status: res.status }, 'embedder: HTTP erro')
      throw new Error(`embedder HTTP ${res.status}`)
    }
    const json = (await res.json()) as { data: { embedding: number[] }[] }
    const vec = json.data[0]?.embedding
    if (!vec) throw new Error('embedder: resposta sem embedding')
    return vec
  }
}
