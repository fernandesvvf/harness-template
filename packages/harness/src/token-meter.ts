// token-meter — coletor de uso de tokens por execução (p/ benchmark de custo).
// Singleton de módulo: o OpenRouterService de cada preset reporta o usage aqui;
// o benchmark-runner reseta antes de cada run e lê o total depois.
//
// Simples de propósito: medir custo é a métrica que diferencia as arquiteturas
// (ReAct caro/N calls vs Plan-Execute barato/2 calls) — P14.

interface TokenUsage {
  prompt: number
  completion: number
  total: number
}

let atual: TokenUsage = { prompt: 0, completion: 0, total: 0 }

/** Zera o contador. Chamar antes de cada execução medida. */
export function resetTokens(): void {
  atual = { prompt: 0, completion: 0, total: 0 }
}

/** Soma o uso de uma chamada LLM. Chamado pelo OpenRouterService. */
export function recordTokens(prompt: number, completion: number): void {
  atual.prompt += prompt
  atual.completion += completion
  atual.total += prompt + completion
}

/** Lê o acumulado da execução atual. */
export function snapshotTokens(): TokenUsage {
  return { ...atual }
}
