# Audit Skills

Skills que verificam conformidade do projeto com os padrões do workspace.
Não criam código — reportam e perguntam antes de corrigir.

---

## `/check-principles`

**Quando usar:** Antes de PR, após sessão longa de desenvolvimento, ao revisar código de terceiros.

Percorre os arquivos do projeto e verifica cada princípio do PATTERNS.md.
Para cada violação: arquivo, linha, problema e correção sugerida.
Ao final, resume por princípio e pergunta o que corrigir.

**Arquivos auditados:**
```
src/agent/graph.ts
src/agent/factory.ts
src/agent/nodes/*.ts
src/agent/nodes/edge-conditions.ts
src/services/*.ts
src/prompts/v1/*.ts
src/config.ts
```

**Princípios verificados (resumo):**

| Princípio | O que checa |
|---|---|
| P1 SoC | Schema no nó? `new XService()` fora do factory? Roteamento no nó? |
| P2 DI | `new XService()` fora do factory? Config lido diretamente no nó? |
| P3 Schema-First | Schema antes das funções? `result.success` antes de `result.data`? |
| P4 Config as Code | Magic numbers? Strings hardcoded fora de `config.ts`? |
| P5 Pure Functions | `import config` em edge-conditions? `await` em edge condition? |
| P6 Graceful Degradation | `try/catch` em todo I/O? Logger com contexto? |
| P7 Prompt Versioning | Cabeçalho nos arquivos de prompt? Imports apontam para `v1/`? |
| P8 Prompts JSON | `JSON.stringify` nos prompts? `instrucao_de_formato` presente? |
| P9 Imutabilidade | `state.campo = valor`? `state.array.push()`? `structuredClone` em dados externos? |
| P10 Papel dos Nós | Nó instancia deps? Nó decide roteamento? Lógica de transformação inline? |

---

## `/check-versions`

**Quando usar:** Ao iniciar projeto, após `npm install`, quando TypeScript apresenta erros de overload no `StateGraph`.

**Sintomas que indicam problema de versão:**
- `No overload matches this call` no construtor do `StateGraph`
- `Property 'channels' is missing` no construtor do grafo
- `ZodObject` sendo passado como tipo do estado nas edge conditions

**O que verifica:**

1. Versões declaradas no `package.json` vs versões canônicas:
   ```json
   { "@langchain/langgraph": "1.1.3", "langchain": "1.2.25",
     "@langchain/core": "^1.1.22", "@langchain/openai": "^1.2.9" }
   ```
2. Versões **instaladas** (não só declaradas) via `.package-lock.json`
3. `tsconfig.json` do app: `moduleResolution: "node"` + `exactOptionalPropertyTypes: false`
4. Imports de zod: todos devem ser `from 'zod/v3'`, nunca `from 'zod'`
5. API do `StateGraph` em `graph.ts`: `{ state: schema }` — sem `Annotation.Root`, sem `{ stateSchema }`

**Correção automática** (após confirmação): atualiza `package.json`, adiciona `overrides` no monorepo se necessário, corrige `tsconfig.json`, substitui imports de zod, migra API do `StateGraph`.

**Problema comum — npm workspace ignora pins:**
Se `npm install` resolve versão diferente da pinada, adicionar ao `package.json` raiz:
```json
{ "overrides": { "@langchain/langgraph": "1.1.3", "langchain": "1.2.25" } }
```
