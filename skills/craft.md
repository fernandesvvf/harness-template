# Craft Skills

Skills que adicionam peças a projetos LangGraph existentes.
Cada skill garante que o código gerado segue os princípios do PATTERNS.md.

**Ordem recomendada ao adicionar uma capability (spec-driven):**
```
/craft-spec   ← O QUÊ (define comportamento + as 5 variações de eval)
   ↓
/craft-tasks  ← lê o spec e deriva quais craft-skills rodar (TodoWrite)
   ↓
/craft-prompt → /craft-llm-node (ou /craft-io-node) → /craft-edge-conditions → /craft-graph-state → /craft-factory
   ↓
/craft-memory <tipo>  ← se a capability precisar de memória persistida
   ↓
/craft-contract  ← COMO VERIFICAR (deriva do spec)
```

`/craft-tasks` é opcional pra capabilities simples (o pipeline acima já é o plano);
vale pra capabilities compostas (vários nós/tools/memória), onde deriva o subconjunto certo.

O spec ancora a intenção; o contrato verifica; os craft-nodes implementam. Sem o spec, o código fica sem alvo e o eval sai solto. Ver `spec.template.md` e `skills/commands/craft-spec.md`.

---

## `/craft-prompt`

**Cria:** `src/prompts/v1/<nome>.prompt.ts`
**Quando usar:** Primeiro passo ao adicionar qualquer nó que chama LLM.
**Princípios:** Schema-First (P3), Prompt Versioning (P7), Configuration as Code (P4)

Garante:
- Cabeçalho de 4 linhas: nome, data, comportamento esperado, gatilho para v2
- Schema Zod exportado ANTES de qualquer função
- `JSON.stringify({...})` nos system e user prompts — nunca template literals
- `instrucao_de_formato` como último campo do system prompt
- Mínimo 4 exemplos few-shot com positivos E negativos

**Não usar quando** o nó não chama LLM — vá direto para `/craft-io-node`.

---

## `/craft-llm-node`

**Cria:** `src/agent/nodes/<nome>.node.ts`
**Quando usar:** Qualquer nó que chama `llm.generateStructured(...)`.
**Pré-requisito:** arquivo de prompt correspondente em `prompts/v1/`.
**Princípios:** DI (P2), Graceful Degradation (P6), Imutabilidade (P9), SoC (P1), Papel dos Nós (P11)

Garante:
- `export function make<Nome>Node(llm: OpenRouterService, ...params)` — DI via parâmetro
- `try/catch` envolvendo todo o bloco de I/O
- `if (!result.success)` antes de qualquer acesso a `result.data`
- `logger.warn/error` com contexto (campos do state relevantes + error)
- Retorno sempre `Partial<AgentState>` — nunca void, nunca string de nó
- `?? fallback` em todos os campos opcionais do estado lidos
- Nenhum `new XService()` — nenhum `config.*` lido diretamente

Inclui decisão arquitetural: **um `OpenRouterService` por nó** (modelo especializado + isolamento de rate limit).

---

## `/craft-io-node`

**Cria:** `src/agent/nodes/<nome>.node.ts`
**Quando usar:** Nó que executa I/O sem LLM — Neo4j, banco, API externa.
**Princípios:** DI (P2), Graceful Degradation (P6), Imutabilidade (P9), SoC (P1)

Garante:
- `structuredClone` em qualquer dado externo que entra no estado
- Lógica de transformação/consolidação extraída como função pura antes do `make*Node`
- `try/catch` completo
- `?? fallback` em campos opcionais do estado
- Nenhum `push` ou mutação direta do estado

---

## `/craft-edge-conditions`

**Cria/atualiza:** `src/agent/nodes/edge-conditions.ts`
**Quando usar:** Ao adicionar qualquer `addConditionalEdges` ao grafo.
**Princípios:** Pure Functions (P5), SoC (P1), Configuration as Code (P4)

Garante:
- Nenhum `import config` — funções puras não têm inputs ocultos
- Nenhum `await` ou I/O de qualquer tipo
- Tipo de retorno explícito: union de strings literais (`'nodeA' | 'nodeB'`)
- Se usa parâmetro de config: aplicação parcial `makeRoute(maxRetries)` — função interna pura
- `?? fallback` em campos opcionais do estado
- Testável com `expect(routeX({ isBlocked: true })).toBe('blocked')`

---

## `/craft-graph-state`

**Cria/atualiza:** `src/agent/graph.ts`
**Quando usar:** Ao criar o grafo ou adicionar novo nó/edge.
**Princípios:** Imutabilidade (P9), DI (P2), Configuration as Code (P4)
**Versões obrigatórias:** `@langchain/langgraph: 1.1.3` + `langchain: 1.2.25`

Garante:
- `import { z } from 'zod/v3'` — nunca `from 'zod'`
- `z.object({ campo: z.tipo().optional() })` — todos os campos `.optional()`
- `new StateGraph({ state: schema })` — nunca `Annotation.Root`, nunca `{ stateSchema }`
- `AgentDeps` interface exportada — grafo recebe deps, não instancia
- Config passado explicitamente nos nós: `makeCypherNode(llm, config.agent.cypherMaxHops)`
- Conditional edges usando funções de `edge-conditions.ts`
- Aplicação parcial de config feita aqui: `makeRoute(config.agent.maxRetries)`

---

## `/craft-factory`

**Cria/atualiza:** `src/agent/factory.ts`
**Quando usar:** Último passo ao criar o agente; também ao adicionar novo service.
**Princípios:** Factory Pattern, DI (P2), Configuration as Code (P4)

Garante:
- `new XService()` aparece APENAS neste arquivo em todo o projeto
- Um `OpenRouterService` por modelo LLM distinto
- Todos os services instanciados com valores de `config.*` — sem magic strings
- `buildAgentGraph(deps)` recebe objeto tipado com `AgentDeps`
- Nenhuma lógica de negócio — só instanciação e delegação
