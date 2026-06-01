# Harness Template — Agentes LangGraph.js

Workspace de Victor Fernandes — AI Automation Architect.
Template de agentes autônomos com **3 arquiteturas cognitivas**, **harness de avaliação** (contratos + Langfuse) e **4 tipos de memória governados por contrato**.

Derivado do `ai-automation-workspace` (template base + chat-dual-memory), reestruturado em torno do material da pós sobre runtime de agentes.

**Como colaborar:** pense como tech lead. Explique o porquê arquitetural e aponte o padrão de software por trás de cada decisão. Victor tem maturidade de dev sênior.

---

## Os 3 pilares deste workspace

```
1. Arquiteturas cognitivas   → COMO o agente pensa  (presets/)
2. Harness                   → COMO SEI que pensa certo  (packages/harness/)
3. Memória governada         → O QUE o agente lembra e por quanto tempo  (memory.md + services)
```

---

## Presets — arquiteturas cognitivas

| Preset | Pasta | Ideia central | Quando usar |
|---|---|---|---|
| **ReAct** | `presets/react/` | loop raciocínio↔ação, tool result volta pro LLM | caminho aberto, ramificações, debugging, pesquisa |
| **Plan-Execute** | `presets/plan-execute/` | planeja tudo, executa mecânico, sintetiza | fluxo previsível, steps independentes, barato |
| **Reflection** | `presets/reflection/` | gerador + critic loop em cima de qualquer base | qualidade crítica (código, jurídico, diagnóstico) |

Cada preset é um `apps/api` LangGraph independente, com `TEMPLATE.md` próprio (placeholders, o que adaptar, checklist).

---

## Harness — `packages/harness/`

Infraestrutura genérica que **executa e avalia** qualquer preset. Nunca muda por projeto.

```
contracts/*.yaml   → 1 spec por capability (happy/edge/adversarial/ambiguous/wrong_tool)
contract.schema.ts → Zod valida o próprio contrato (Schema-First no contrato)
runner.ts          → lê yaml, roda grafo com callback Langfuse, pontua, envia scores
evaluate.ts        → funções PURAS de scoring (testáveis sem LLM)
judges.ts          → LLM-as-judge (convenção prompts/v1)
tracer.ts          → callback Langfuse
```

Roda: `npm run eval` (turbo) ou `tsx packages/harness/src/runner.ts <contrato>`.

---

## Memória — 4 tipos, governados por `memory.md`

| Tipo | Função | Ciclo de vida | impl | Onde |
|---|---|---|---|---|
| **CURTA** | estado da execução atual | morre com a execução | `local` | state do grafo |
| **LONGA** | fatos confirmados do domínio | persiste sempre | `arquivo` (pg) | `long-term-memory.service` |
| **EPISÓDICA** | resumos de execuções passadas | tempo configurável (ttl) | `arquivo` (pg) | `episodic-memory.service` |
| **CONTEXTUAL** | fragmentos por similaridade | consulta sob demanda | `embedding` (pgvector) | `contextual-memory.service` |

`memory.md` na raiz de cada projeto declara a política de cada tipo (enabled, ttl, limiar, max_fragmentos). Memória mal configurada custa tokens ou faz o agente errar (cenários BOA / IRRELEVANTE / PERIGOSA) — por isso é medida pelo harness, não confiada à intuição.

---

## Referências

- [PATTERNS.md](./PATTERNS.md) — princípios arquiteturais (P1–P16) com exemplos correto/errado
- [skills/INDEX.md](./skills/INDEX.md) — catálogo de skills
- [skills/harness.md](./skills/harness.md) — como escrever contratos e rodar evals
- [skills/memory.md](./skills/memory.md) — os 4 tipos e suas políticas

---

## Skills

| Comando | O que faz |
|---|---|
| `/scaffold-architecture <react\|plan\|reflection>` | Scaffolda um preset novo a partir do template da arquitetura |
| `/craft-spec <capability>` | Spec (O QUÊ) antes de construir — fonte do contrato de eval |
| `/craft-tasks <capability>` | Lê o spec e deriva as craft-skills a rodar (TodoWrite) |
| `/craft-contract <capability>` | Cria um contrato YAML com as 5 variações obrigatórias (deriva do spec) |
| `/craft-dataset <tipo> <nome>` | Cria dataset de eval (memory/tool/behavior) com ground-truth |
| `/tune-suite <nome>` | Calibra limiares da suite a partir dos resultados reais |
| `/craft-memory <curta\|longa\|episodica\|contextual>` | Adiciona um tipo de memória + entrada no `memory.md` |
| `/craft-prompt` `/craft-llm-node` `/craft-io-node` | Craft de nós (herdados do template antigo) |
| `/craft-edge-conditions` `/craft-graph-state` `/craft-factory` | Craft de grafo/roteamento/DI |
| `/check-principles` | Auditoria de conformidade com PATTERNS.md |

---

## Convenções não-negociáveis (do template antigo)

- `import { z } from 'zod/v3'` — nunca `from 'zod'`
- `new StateGraph({ state: schema })` — nunca `Annotation.Root`
- Versões: `@langchain/langgraph 1.1.3` + `langchain 1.2.25`
- Um `OpenRouterService` por nó LLM
- `new XService()` só no `factory.ts`
- Nós retornam `Partial<State>`, nunca mutam
- Prompts em `prompts/v1/` com cabeçalho de 4 linhas + Zod antes de qualquer função
