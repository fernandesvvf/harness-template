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

> Novo no assunto? Comece por [docs/learning.md](./docs/learning.md) — explica cada conceito do zero, com analogias e exemplos.
> Quer ver rodando? [examples/incident-agent](./examples/incident-agent/) — exemplo completo clone-e-rode (agente SRE) com os 3 pilares + os 5 modos de eval.

---

## Presets (arquiteturas cognitivas)

| Preset | Fluxo | Quando usar |
|---|---|---|
| **ReAct** | `agent ⇄ tools` | caminho aberto, ramificações, debugging |
| **Plan-Execute** | `planner → executor* → synthesizer` | fluxo previsível, steps independentes, barato |
| **Reflection** | `generator ⇄ critic` | qualidade crítica (código, jurídico, diagnóstico) |

Cada preset é um `apps/api` LangGraph independente com `TEMPLATE.md` próprio. Os 3 seguem o ciclo `recuperar → perceber → planejar → agir → avaliar → persistir`. Memória é opt-in via `memory.md`: **react** já vem com tudo ligado (LONGA + EPISÓDICA + CONTEXTUAL + reflexão evolutiva); **plan-execute** usa memória enxuta (filtro); **reflection** usa o kit completo.

---

## Estrutura

```
harness-template/
├── presets/
│   ├── react/            ✅ memória + reflexão evolutiva ligadas
│   ├── plan-execute/
│   └── reflection/
├── packages/
│   ├── harness/          contratos + datasets + suites + scorers + judges + benchmark + Langfuse
│   │   └── evals/        datasets/ (casos) · suites/ (gate) · resultados/ (histórico)
│   ├── memory/           4 tipos (3 services + CURTA no state) + memory.md loader
│   └── types/            tipos compartilhados
├── examples/
│   └── incident-agent/   exemplo completo rodável (clone-e-rode) — agente SRE
├── scripts/benchmark.ts  compara os 3 presets no mesmo dataset
├── benchmarks/           report.md comparativo (gerado)
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

# suite (gate de qualidade — exit != 0 se violar limiar; serve de CI)
npm run eval:suite -- ../../../../packages/harness/evals/suites/tool_selection.yaml

# memória ponta a ponta (escrita + leitura entre execuções)
npm run smoke

# reflexão evolutiva nível 2 (padrões → fatos duráveis)
npm run consolidate-lessons -- <scopeId>

# benchmark comparativo — roda o mesmo dataset nos 3 presets → benchmarks/report.md
npm run benchmark
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

Eval orientada a dados: `/craft-dataset <tipo> <nome>` (cria dataset com ground-truth) e `/tune-suite <nome>` (calibra os limiares do gate a partir de resultados reais).

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

> Quer trocar de stack no futuro? [PORTING.md](./PORTING.md) separa o **núcleo portável** (conceitos + formatos de dado + métricas) dos **adaptadores de stack** (LangGraph/pgvector/OpenRouter) — com mapa e checklist de migração.

---

## Harness — 5 modos de avaliação

| Modo | O quê | Comando |
|---|---|---|
| **Contrato** + juiz LLM | qualidade subjetiva por capability | `npm run eval` |
| **Dataset** + scorer | acerto objetivo vs ground-truth | `npm run eval:datasets` |
| **Memory-impact** | a memória *ajuda*? (com vs sem) | `npm run eval:memory` |
| **Suite** (gate) | barra regressão (exit != 0) | `npm run eval:suite` |
| **Benchmark** | compara arquiteturas (tokens/tempo) | `npm run benchmark` |

Regra: contrato/dataset/memory-impact **medem** · suite **decide** · benchmark **compara**. Detalhes em [docs/learning.md](./docs/learning.md) §3.

---

## Status

`turbo typecheck` verde nos 7 pacotes. **Validado em runtime** (react preset, contra Postgres + OpenRouter + Langfuse reais):

- ✅ ReAct loop + tools + guardrails (smoke 1-4)
- ✅ memória 4-tipos + pgvector + reflexão evolutiva (escrita/leitura entre execuções)
- ✅ harness: contrato + judges + dataset + benchmark (tokens reais)
- ✅ Langfuse: traces + scores + custo no dashboard (v2 self-host)

Limitações conhecidas e o que ainda não foi validado: [KNOWN_ISSUES.md](./KNOWN_ISSUES.md).

Rodar: Docker + `OPENROUTER_API_KEY` no `.env` → `npm run smoke` / `eval` / `eval:datasets` / `eval:suite` / `eval:memory` / `benchmark`.
