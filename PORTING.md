# Portabilidade — trocar de stack sem perder o conhecimento

Este template é **implementado** numa stack específica (LangGraph.js + OpenRouter + Postgres/pgvector + TypeScript). Mas o **conhecimento** que ele captura é agnóstico de stack. Este documento separa as duas coisas, pra que você possa portar pra outra stack (Python/LangGraph, CrewAI, Mastra, um framework próprio…) sem reinventar os conceitos.

> Objetivo: **manter o template na stack atual** e ter um mapa pronto caso precise trocar.

---

## Princípio: núcleo portável vs adaptador de stack (hexagonal)

Pense em duas camadas:

```
┌─────────────────────────────────────────────┐
│  NÚCLEO PORTÁVEL (viaja entre stacks)         │
│  - conceitos: 4 memórias, ciclo, 5 variações  │
│  - formatos de dado: memory.md, contratos,    │
│    datasets, suites (texto/YAML/JSON)          │
│  - métricas: as 6 de memória, cobertura...     │
│  - políticas: limiar, ttl, tetos de loop       │
└───────────────┬─────────────────────────────┘
                │ implementado por
┌───────────────▼─────────────────────────────┐
│  ADAPTADORES DE STACK (trocam ao portar)      │
│  - grafo:    LangGraph StateGraph             │
│  - LLM:      OpenRouterService                │
│  - memória:  Postgres/pgvector/knex           │
│  - embedding: OpenRouter /embeddings          │
│  - runtime:  TypeScript / Node / tsx          │
└─────────────────────────────────────────────┘
```

**Regra de ouro:** trocar de stack = reescrever **adaptadores**, nunca o núcleo. Os formatos de dado e os conceitos permanecem idênticos — são a fonte da verdade que sobrevive.

---

## Os formatos de dado portáveis (o que sobrevive intacto)

São texto puro (YAML/JSON). Independem de linguagem. **Copie-os direto pra nova stack.**

### 1. `memory.md` — contrato dos 4 tipos de memória
Política declarativa. Qualquer stack lê isto e implementa do seu jeito.
```yaml
memorias:
  curta:      { tipo: local,     enabled: true }
  longa:      { tipo: arquivo,   enabled: false, store: pg }
  episodica:  { tipo: arquivo,   enabled: false, store: pg, ttl_dias: 30 }
  contextual: { tipo: embedding, enabled: false, store: pgvector, limiar: 0.78, max_fragmentos: 5 }
```
Portável: os campos `tipo`, `enabled`, `ttl_dias`, `limiar`, `max_fragmentos`.
Específico (troca): `store: pg`/`pgvector` → o equivalente da sua stack.

### 2. Contrato de eval (`contracts/*.yaml`)
Comportamento esperado por capability + as 5 variações.
```yaml
name: "..."
cases:
  - id: happy_path
    input: "..."
    assertions:
      tool_calls: [{ tool: "x", required: true }]
      output: { contains: ["..."], judge: "answer_completeness", min_score: 0.8 }
```
Portável: estrutura inteira. Específico: como o runner *executa* o agente.

### 3. Dataset (`evals/datasets/*.json`)
Casos com ground-truth, 3 tipos: `memory_impact`, `tool_selection`, `behavior`.
```json
{ "tipo": "tool_selection",
  "casos": [{ "id":"...", "entrada":"...", "tools_esperadas":["x"], "tools_proibidas":["y"] }] }
```
Portável: 100%. É só dado.

### 4. Suite (`evals/suites/*.yaml`)
Gate: dataset + limiares.
```yaml
nome: tool_selection
dataset: ../datasets/tool_selection_cases.json
limiares: { tools_esperadas_ok: { min: 0.8 } }
```
Portável: 100%. A semântica de PASS/FAIL é universal.

### 5. Suite de memory-impact (`memory_impact_eval.yaml`)
```yaml
dataset: memory_impact_cases.json
thresholds: { retrieval_precision: 0.8, decision_improvement: 0.0, ... }
```
Portável: as 6 métricas + thresholds. Específico: como rodar "com vs sem memória".

---

## Conceitos que toda stack deve implementar

Independentes de framework — são o "o quê", não o "como":

- **4 tipos de memória:** CURTA (estado), LONGA (fatos), EPISÓDICA (resumos+lições), CONTEXTUAL (semântica). Ciclos de vida: morre / persiste / ttl / sob demanda.
- **Dois modos de busca:** filtro (exato) vs significado (embedding).
- **Ciclo de 6 fases:** recuperar → perceber → planejar → agir → avaliar → persistir.
- **3 arquiteturas:** ReAct (loop), Plan-Execute (planeja→executa), Reflection (gera⇄critica).
- **5 variações de eval:** happy_path, edge_case, adversarial, ambiguous, wrong_tool_temptation.
- **6 métricas de memory-impact:** retrieval_precision/recall, memory_utilization, hallucination_from_memory, decision_improvement, lesson_quality.
- **Reflexão evolutiva:** lição só se inesperado + generalizável; padrões consolidados a cada N.
- **3 cenários de memória:** BOA / IRRELEVANTE / PERIGOSA — e as políticas que os mitigam.

Detalhes conceituais em [docs/learning.md](./docs/learning.md) e [PATTERNS.md](./PATTERNS.md) (P14–P17).

---

## Mapa: conceito → onde vive hoje → o que o port precisa garantir

| Conceito (portável) | Stack atual (adaptador) | O equivalente na nova stack precisa… |
|---|---|---|
| Grafo de fases | `agent/graph.ts` (LangGraph `StateGraph`) | montar o mesmo fluxo de nós/fases |
| Estado da execução (CURTA) | state Zod do grafo | um objeto de estado por execução |
| Chamada LLM + structured output | `services/openrouter.service.ts` | cliente LLM com validação de schema |
| Tokens (benchmark) | `recordUsage` → `token-meter.ts` | reportar usage por chamada |
| LONGA / EPISÓDICA | `packages/memory/*.service.ts` (Postgres) | persistência por scopeId; filtro exato |
| CONTEXTUAL | `contextual-memory.service.ts` (pgvector) | busca por similaridade + limiar |
| Embedding | `services/embedder.service.ts` | texto → vetor |
| Recall / Persist | nós `recall`/`persist` | ler memória antes; escrever depois |
| Reflexão evolutiva | `persist.node` + `consolidate-lessons.ts` | lição-se-inesperado + batch de padrões |
| Runner de contrato | `harness/runner.ts` | executa agente, pontua, agrega |
| Scorers | `harness/scorers.ts`, `memory-eval.ts` | funções **puras** — portam quase 1:1 |
| Gate de suite | `harness/suite-runner.ts` | exit != 0 se violar limiar |
| Benchmark | `harness/benchmark-runner.ts` | roda dataset em N arquiteturas |

Note: **scorers e métricas são funções puras** (sem I/O) — em qualquer linguagem é só reescrever a lógica. São a parte mais fácil de portar e a mais valiosa de preservar idêntica.

---

## Checklist — portar pra uma nova stack

1. **Copie os formatos de dado** (memory.md, contracts/, datasets/, suites/) — não mudam.
2. **Reimplemente os adaptadores** (tabela acima), do mais externo pro mais interno:
   - cliente LLM (com structured output + report de tokens)
   - persistência de memória (filtro) + busca semântica (embedding)
   - montagem do grafo/fluxo das 6 fases
3. **Porte os scorers** (puros) — reescreva a lógica, mantenha as fórmulas idênticas.
4. **Reimplemente os runners** (contrato/dataset/suite/memory-impact/benchmark) usando os scorers.
5. **Valide a paridade:** rode os MESMOS datasets/suites na nova stack. Os scores devem bater (ou explicar a diferença). É assim que você prova que portou certo — não por inspeção, por eval.
6. **Mantenha os conceitos:** 4 memórias, ciclo de 6 fases, 5 variações, reflexão evolutiva. Se a nova stack não suporta uma fase, documente o gap (como fizemos no `learning.md`).

> O harness é a sua rede de segurança ao portar: se os mesmos contratos/suites passam na stack nova, o comportamento foi preservado. Stack muda, **garantia de qualidade não**.

---

## O que NÃO portar (deixe morrer com a stack antiga)

- Versões pinadas (`@langchain/langgraph 1.1.3`), `tsconfig`, `zod/v3`, turbo/workspaces.
- Detalhes de pgvector (`<=>`, `vector(1536)`), knex, Fastify.
- Convenções de TS (`Partial<State>`, `withLangGraph`).

Essas são decisões da stack atual — corretas aqui, irrelevantes na próxima. O núcleo (formatos + conceitos + métricas) é o que você carrega.
