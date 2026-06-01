---
description: Scaffolda um preset de arquitetura cognitiva (react|plan|reflection) num novo projeto
argument-hint: <react|plan|reflection>
---

## Contexto
Referência: `skills/architectures.md`, `PATTERNS.md` P14. Templates: `presets/<arch>/`.
Material da aula: `arquiteturas-cognitivas.md` (ReAct, Plan-Execute, Reflection).

## Perguntas (uma por vez)
1. Qual arquitetura? (react | plan | reflection) — se não passada no argumento
2. Nome do projeto (slug kebab-case)?
3. Domínio do agente (1 frase) — pra adaptar prompt e guardrails
4. Quais tools/ações o agente terá? (react/reflection) OU quais steps fixos? (plan)
5. (reflection) Critic self (mesmo modelo) ou cross (modelo maior)?

## Padrão Obrigatório

### CORRETO ✅
```typescript
// teto de loop SEMPRE em config.ts (P14 + P8)
REACT_MAX_STEPS: z.coerce.number().default(6)
// estado com histórico usa reducer
messages: withLangGraph(z.custom<BaseMessage[]>(), MessagesZodMeta)
// um OpenRouterService por nó, instanciado só no factory
agentLlm: new OpenRouterService(config.models.agent)
```

### ERRADO ❌
```typescript
while (true) { ... }                        // ❌ loop sem teto → alucina/infinito
const llm = new OpenRouterService(...)       // ❌ dentro de nó, não no factory
import { z } from 'zod'                       // ❌ tem que ser 'zod/v3'
new StateGraph({ stateSchema })              // ❌ é { state: schema }
```

## Passos de Execução
1. Escolher arquitetura pela natureza do problema (tabela em architectures.md).
2. Copiar `presets/<arch>/` pro destino.
3. Substituir slug/nome em package.json, config.ts (X_TITLE), .env.example.
4. Adaptar `tools/index.ts` (ou steps do planner), `prompts/v1/agent.prompt.ts`, `guardrails.prompt.ts`.
5. Ajustar tetos de loop e modelos em `config.ts`.
6. Copiar `memory.md` da raiz; deixar só CURTA enabled por padrão.
7. Conferir `evals/run.ts` normaliza a execução em `RunResult`.
8. `npm install` na raiz; `npx tsc --noEmit` no preset.

## Checklist de Saída
- [ ] Arquitetura justificada pela natureza do problema
- [ ] Teto de loop em config.ts
- [ ] zod/v3 + `new StateGraph({ state })` + um service por nó
- [ ] guardrails + blocked presentes
- [ ] typecheck limpo
- [ ] 1 contrato de eval com as 5 variações
