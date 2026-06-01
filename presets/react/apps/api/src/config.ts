import { z } from 'zod/v3'

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3001),

  OPENROUTER_API_KEY: z.string(),
  OPENROUTER_BASE_URL: z.string().url().default('https://openrouter.ai/api/v1'),
  OPENROUTER_HTTP_REFERER: z.string().url().default('http://localhost:3000'),
  OPENROUTER_X_TITLE: z.string().default('react-agent'),
  OPENROUTER_FALLBACK_MODEL: z.string().default('nvidia/nemotron-3-super-120b-a12b:free'),
  OPENROUTER_TEMPERATURE: z.coerce.number().default(0.1),
  OPENROUTER_MAX_RETRIES: z.coerce.number().default(0),
  OPENROUTER_LOG_SNIPPET_LENGTH: z.coerce.number().default(200),

  // Modelos por nó LLM
  GUARDRAILS_MODEL: z.string().default('anthropic/claude-haiku-4-5-20251001'),
  AGENT_MODEL: z.string().default('anthropic/claude-sonnet-4-6'),

  // Parâmetro central do ReAct: teto de iterações do loop.
  // Guarda a falha "contexto longo → alucina no meio do loop" (aula).
  REACT_MAX_STEPS: z.coerce.number().default(6),

  // Memória (LONGA + CONTEXTUAL). Política fica no memory.md; aqui só infra.
  MEMORY_DATABASE_URL: z.string().default('postgresql://harness:harness@localhost:5432/harness_memory'),
  EMBEDDING_MODEL: z.string().default('openai/text-embedding-3-small'),
  EMBEDDING_DIM: z.coerce.number().default(1536),

  API_VERSION: z.string().default('0.1.0'),
  HOST: z.string().default('0.0.0.0'),
})

const parsed = EnvSchema.safeParse(process.env)
if (!parsed.success) {
  console.error('❌ Variáveis de ambiente inválidas:')
  console.error(parsed.error.flatten().fieldErrors)
  process.exit(1)
}

export const config = {
  env: parsed.data.NODE_ENV,
  port: parsed.data.PORT,

  openrouter: {
    apiKey: parsed.data.OPENROUTER_API_KEY,
    baseUrl: parsed.data.OPENROUTER_BASE_URL,
    httpReferer: parsed.data.OPENROUTER_HTTP_REFERER,
    xTitle: parsed.data.OPENROUTER_X_TITLE,
    fallbackModel: parsed.data.OPENROUTER_FALLBACK_MODEL,
    temperature: parsed.data.OPENROUTER_TEMPERATURE,
    maxRetries: parsed.data.OPENROUTER_MAX_RETRIES,
    logSnippetLength: parsed.data.OPENROUTER_LOG_SNIPPET_LENGTH,
  },

  models: {
    guardrails: parsed.data.GUARDRAILS_MODEL,
    agent: parsed.data.AGENT_MODEL,
  },

  agent: {
    reactMaxSteps: parsed.data.REACT_MAX_STEPS,
  },

  memory: {
    databaseUrl: parsed.data.MEMORY_DATABASE_URL,
    embeddingModel: parsed.data.EMBEDDING_MODEL,
    embeddingDim: parsed.data.EMBEDDING_DIM,
  },

  server: {
    version: parsed.data.API_VERSION,
    host: parsed.data.HOST,
  },
} as const
