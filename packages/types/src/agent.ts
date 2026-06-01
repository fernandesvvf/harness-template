// Tipos compartilhados entre presets e harness.
// ADAPTE ao domínio do seu projeto; o que está aqui é o mínimo comum.

/** Resposta final padrão de um agente, qualquer arquitetura. */
export interface AgentResponse {
  prose: string
  blocked: boolean
  blockReason?: string
}

/** Arquiteturas cognitivas suportadas pelos presets. Usado em tags do Langfuse. */
export type CognitiveArchitecture = 'react' | 'plan-execute' | 'reflection'
