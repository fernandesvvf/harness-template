---
description: Adiciona um tipo de memória (curta|longa|episodica|contextual) e atualiza o memory.md
argument-hint: <curta|longa|episodica|contextual>
---

## Contexto
Referência: `skills/memory.md`, `PATTERNS.md` P16. Pacote: `@harness/memory`.
Contrato: `memory.md`. Schema: `packages/memory/src/memory.schema.ts`.

## Perguntas (uma por vez)
1. Qual tipo? (curta | longa | episodica | contextual)
2. Em qual preset/projeto adicionar?
3. (episodica) ttl em dias? (null = nunca expira)
4. (contextual) limiar de similaridade? max_fragmentos? dimensão do embedding?
5. (contextual) qual provedor de embedding? (define o `Embedder`)
6. Em qual nó o contexto da memória é injetado no prompt?

## Padrão Obrigatório

### CORRETO ✅
```typescript
// factory.ts — único new XService(); política lida do memory.md
const contract = loadMemoryContract('memory.md')
const longa = new LongTermMemoryService()
const ctx = new ContextualMemoryService(embed, {
  limiar: contract.memorias.contextual.limiar,
  maxFragmentos: contract.memorias.contextual.max_fragmentos,
}, 1536)
// nó recebe por parâmetro (DI)
makeAgentNode(agentLlm, tools, longa)
```

### ERRADO ❌
```typescript
const longa = new LongTermMemoryService()    // ❌ dentro de um nó, não no factory
{ limiar: 0.5, maxFragmentos: 20 }            // ❌ política hardcoded, não do memory.md
// CURTA com service                          // ❌ CURTA é campo no state, não tem service
```

## Passos de Execução
1. `enabled: true` no tipo dentro do `memory.md` do projeto (CURTA já é true).
2. CURTA: adicionar campo no state do grafo (`z.object`), sem service. FIM.
3. LONGA/EPISÓDICA/CONTEXTUAL: instanciar o service no `factory.ts`, lendo política via `loadMemoryContract`.
4. Injetar o service no nó consumidor por parâmetro (DI).
5. No nó, injetar `getContextForPrompt(userId)` no system prompt; aplicar limiar/ttl da política.
6. `docker-compose up -d postgres`; rodar typecheck.
7. Escrever contrato de eval provando cenário BOA e ausência de IRRELEVANTE/PERIGOSA.

## Checklist de Saída
- [ ] Tipo enabled no memory.md, validado pelo schema
- [ ] Service só no factory.ts (exceto CURTA, que é state)
- [ ] Política lida do contrato, nunca hardcoded
- [ ] Contexto injetado no system prompt do nó certo
- [ ] Postgres no ar; typecheck limpo
- [ ] Eval cobre BOA + IRRELEVANTE + PERIGOSA
