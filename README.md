# Harness Template — Agentes LangGraph.js

Template de agentes autônomos com **3 arquiteturas cognitivas**, **harness de avaliação** e **memória governada por contrato**. Monorepo TypeScript (Turborepo + LangGraph 1.1.x + OpenRouter).

Construído a partir do material da pós sobre runtime de agentes — traduz os conceitos da aula (arquiteturas, contratos, 4 tipos de memória, reflexão evolutiva) num template reaproveitável com boas práticas de software.

---

## Os 3 pilares

```
1. Arquiteturas cognitivas   → COMO o agente pensa          (presets/)
2. Harness                   → COMO SEI que pensa certo      (packages/harness/)
3. Memória governada         → O QUE lembra e por quanto tempo (packages/memory/ + memory.md)
```

E, em cima, **Spec-Driven**: define o comportamento (O QUÊ) antes de construir.

> Novo no assunto? Comece por [docs/CONCEITOS.md](./docs/CONCEITOS.md) — explica cada conceito do zero, com analogias e exemplos.

---

## Presets (arquiteturas cognitivas)

| Preset | Fluxo | Quando usar |
|---|---|---|
| **ReAct** | `agent ⇄ tools` | caminho aberto, ramificações, debugging |
| **Plan-Execute** | `planner → executor* → synthesizer` | fluxo previsível, steps independentes, barato |
| **Reflection** | `generator ⇄ critic` | qualidade crítica (código, jurídico, diagnóstico) |

Cada preset é um `apps/api` LangGraph independente com `TEMPLATE.md` próprio. O preset **react** já vem com memória ligada (LONGA + EPISÓDICA + CONTEXTUAL) e reflexão evolutiva como referência.

---

## Estrutura

```
harness-template/
├── presets/
│   ├── react/            ✅ memória + reflexão evolutiva ligadas
│   ├── plan-execute/
│   └── reflection/
├── packages/
│   ├── harness/          runner + contratos YAML + datasets + judges + scorers + Langfuse
│   ├── memory/           4 tipos (3 services + CURTA no state) + memory.md loader
│   └── types/            tipos compartilhados
├── skills/               catálogo de skills (commands/) + docs por categoria
├── docker-compose.yml    Postgres+pgvector + Langfuse self-host
├── memory.md             contrato dos 4 tipos de memória
├── spec.template.md      modelo de spec (spec-driven)
├── PATTERNS.md           princípios P1–P17
└── CLAUDE.md             instruções para o agente (Claude Code)
```

---

## Quickstart

```bash
# 1. deps
npm install

# 2. infra (Postgres+pgvector p/ memória, Langfuse p/ observabilidade)
docker-compose up -d postgres        # +langfuse se quiser traces

# 3. configurar um preset
cd presets/react/apps/api
cp .env.example .env                  # preencher OPENROUTER_API_KEY

# 4. rodar
npm run dev                           # sobe a API (POST /chat)
```

### Verificar (harness)

```bash
# contrato (comportamento via judges)
npm run eval -- ../../../../packages/harness/src/contracts/buscar_produto.yaml

# datasets (score objetivo vs ground-truth)
npm run eval:datasets -- ../../../../packages/harness/evals/datasets/tool_selection_cases.json

# memória ponta a ponta (escrita + leitura entre execuções)
npm run smoke

# reflexão evolutiva nível 2 (padrões → fatos duráveis)
npm run consolidate-lessons -- <scopeId>
```

---

## Memória — 4 tipos

| Tipo | Função | Ciclo de vida | impl |
|---|---|---|---|
| **CURTA** | estado da execução | morre com a execução | state do grafo |
| **LONGA** | fatos confirmados | persiste sempre | Postgres |
| **EPISÓDICA** | resumos + lições | ttl configurável | Postgres |
| **CONTEXTUAL** | fragmentos por similaridade | sob demanda | pgvector |

Governados por `memory.md` (política validada por Zod). Dois modos de busca: **filtro** (LONGA/EPISÓDICA) e **semântica** (CONTEXTUAL).

**Reflexão evolutiva** (aprender com erros): lição extraída só quando o resultado é inesperado, generalizável; padrões consolidados a cada N execuções → vira fato durável.

---

## Fluxo de desenvolvimento (skills)

```
/scaffold-architecture <react|plan|reflection>   ← cria o preset
   ↓
/craft-spec <capability>      ← define O QUÊ (+ 5 variações de eval)
   ↓
/craft-tasks <capability>     ← deriva as craft-skills a rodar
   ↓
/craft-prompt → /craft-*-node → /craft-edge-conditions → /craft-graph-state → /craft-factory
   ↓
/craft-memory <tipo>          ← se usar memória persistida
   ↓
/craft-contract <capability>  ← deriva o eval do spec
   ↓
/check-principles             ← audita P1–P17
```

Skills são `.md` em `skills/commands/` — copie/symlinke para `~/.claude/commands/`. Catálogo em [skills/INDEX.md](./skills/INDEX.md).

---

## Convenções não-negociáveis

- `import { z } from 'zod/v3'` — nunca `from 'zod'`
- `new StateGraph({ state: schema })` — nunca `Annotation.Root`
- Versões: `@langchain/langgraph 1.1.3` + `langchain 1.2.25`
- `tsconfig`: `moduleResolution: "bundler"`
- Um `OpenRouterService` por nó LLM; `new XService()` só no `factory.ts`
- Nós retornam `Partial<State>`, nunca mutam
- Todo loop com teto explícito em `config.ts`

Detalhes em [PATTERNS.md](./PATTERNS.md).

---

## Status

Os 6 pacotes passam `turbo typecheck`. A execução em runtime (contra Postgres + OpenRouter reais) depende de Docker + `OPENROUTER_API_KEY` configurados — use os scripts de `npm run smoke` / `eval` / `eval:datasets` para validar.
