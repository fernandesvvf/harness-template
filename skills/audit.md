# Audit Skills

Skills que verificam conformidade do projeto com os padrões (PATTERNS.md P1–P17).
Não criam código — reportam e perguntam antes de corrigir.

---

## `/check-principles`

**Quando usar:** antes de PR, após sessão longa, ao revisar código.

Percorre os arquivos e verifica cada princípio. Para cada violação: arquivo, linha, problema, correção. Resume por princípio e pergunta o que corrigir.

**Arquivos auditados:**
```
src/agent/graph.ts
src/agent/factory.ts
src/agent/nodes/*.ts          (inclui recall.node, persist.node quando há memória)
src/agent/nodes/edge-conditions.ts
src/services/*.ts
src/prompts/v1/*.ts
src/config.ts
specs/*.spec.md               (P17 — capability tem spec?)
```

**Princípios verificados:**

| Princípio | O que checa |
|---|---|
| P1 SoC | Schema dentro do nó? `new XService()` fora do factory? Roteamento dentro do nó? |
| P2 DI | Nó recebe deps por parâmetro? Config lido direto no nó? |
| P3 Factory | `new XService()` aparece SÓ no factory.ts? |
| P4 Strategy | `generateStructured<T>` com schema como parâmetro (não métodos duplicados)? |
| P5 Schema-First | Schema Zod antes das funções? `result.success` antes de `result.data`? |
| P6 Pure Functions | `import config`/`await` em edge-conditions? edge é pura e testável? |
| P7 Imutabilidade | `state.x = v`? `state.arr.push()`? retorno é `Partial<State>`? `structuredClone` em dado externo? |
| P8 Config as Code | Magic numbers? Teto de loop em config? Política de memória lida do `memory.md`, não hardcoded? |
| P9 Graceful Degradation | `try/catch` em todo I/O? Fail-safe (guardrails bloqueia; memória falha → segue)? |
| P10 Prompt Versioning | Cabeçalho de 4 linhas? Imports apontam `prompts/v1/`? |
| P11 Papel dos Nós | Nó orquestra (não instancia, não roteia, não implementa I/O)? recall/persist são io-nodes? |
| P14 Arquitetura Cognitiva | Teto de loop explícito (REACT_MAX_STEPS / PLANNER_MAX_STEPS / REFLECTION_MAX_ITER)? grafo segue a arquitetura? |
| P15 Harness | Capability tem contrato em `packages/harness/contracts/`? `evaluate` puro? judges existem? |
| P16 Memória | Tipo enabled no `memory.md`? Service só no factory? CURTA é state (sem service)? limiar/ttl da política? |
| P17 Spec-Driven | Capability tem `specs/<cap>.spec.md`? Contrato deriva das 5 variações do spec? |

---

## `/check-versions`

**Quando usar:** ao iniciar projeto, após `npm install`, em erros de overload no `StateGraph`.

**Sintomas de problema de versão:**
- `No overload matches this call` no construtor do `StateGraph`
- `has no exported member 'ToolNode'` (import do pacote errado)
- `Cannot find module '@langchain/langgraph/zod'` (moduleResolution errado)

**O que verifica:**

1. Versões canônicas no `package.json` (raiz tem `overrides`):
   ```json
   { "@langchain/langgraph": "1.1.3", "langchain": "1.2.25",
     "@langchain/core": "^1.1.22", "@langchain/openai": "^1.2.9" }
   ```
2. Versões **instaladas** (não só declaradas).
3. `tsconfig` do app: `moduleResolution: "bundler"` (NÃO `node` — subpaths `/prebuilt` e `/zod` exigem bundler) + `exactOptionalPropertyTypes: false`. Sem `rootDir` quando importa `src/` de pacotes irmãos via `paths`.
4. Imports de zod: todos `from 'zod/v3'`, nunca `from 'zod'`.
5. `StateGraph`: `{ state: schema }` — sem `Annotation.Root`, sem `{ stateSchema }`.
6. `ToolNode` de `@langchain/langgraph/prebuilt`; `MessagesZodMeta` de `@langchain/langgraph`; `withLangGraph` de `@langchain/langgraph/zod`.

**Problema comum — npm workspace ignora pins:** adicionar `overrides` ao `package.json` raiz.

**Workspace deste template:** `workspaces: ["presets/*/apps/*", "packages/*"]` — presets não são workspaces aninhados.
