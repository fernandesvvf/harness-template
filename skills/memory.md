# Memória — 4 tipos governados por contrato

Princípio: P16 (Governança de Memória). Pacote: `@harness/memory`. Contrato: `memory.md`.

---

## Os 4 tipos

| Tipo | Função | Ciclo de vida | impl | Service |
|---|---|---|---|---|
| **CURTA** | estado da execução | morre com a execução | `local` | nenhum (state do grafo) |
| **LONGA** | fatos confirmados | persiste sempre | `arquivo` (pg) | `LongTermMemoryService` |
| **EPISÓDICA** | resumos de execuções | ttl configurável | `arquivo` (pg) | `EpisodicMemoryService` |
| **CONTEXTUAL** | fragmentos por similaridade | sob demanda | `embedding` (pgvector) | `ContextualMemoryService` |

## O contrato `memory.md`

Bloco ```yaml``` declara a política de cada tipo. Validado por `memory.schema.ts` — política inválida falha antes de rodar. Ver `memory.md` na raiz.

## Dois modos de buscar

- **Filtro** (exato, `WHERE scope_id`): LONGA, EPISÓDICA — quando você sabe a chave.
- **Significado** (embedding, `<=>`): CONTEXTUAL — quando tem uma pergunta e quer o parecido.

## Reflexão evolutiva (aprender com os próprios erros)

Dois níveis no preset react:

| Nível | Quando | O quê | Onde |
|---|---|---|---|
| **N1 — lição** | ao fim de cada run, SÓ se inesperado (erro de tool / teto de passos) | LLM extrai 1 lição **generalizável** (não específica ao input) → EPISÓDICA `kind=lesson` | `persist.node` |
| **N2 — padrão** | manual, a cada ~N execuções | LLM detecta padrões **recorrentes** nas lições → promove a fato durável (LONGA) | `scripts/consolidate-lessons.ts` |

Regras (da aula): lição só quando há surpresa; deve ser generalizável; padrões emergem do agregado (~10 runs). No recall, as lições vivas são injetadas no prompt ("evite repetir erros").

```bash
npm run consolidate-lessons -- <scopeId>   # nível 2
```

## Os 3 cenários (por que medir)

| Cenário | Causa | Política que mitiga |
|---|---|---|
| **BOA** | memória ajudou | — (objetivo) |
| **IRRELEVANTE** | limiar baixo polui contexto | `limiar`, `max_fragmentos` |
| **PERIGOSA** | fato desatualizado | `ttl_dias`, `purgeExpired()` |

---

## `/craft-memory <curta|longa|episodica|contextual>`

**Faz:**
1. `enabled: true` no tipo dentro do `memory.md` do projeto
2. Injeta o service no `factory.ts` do preset (DI — único `new XService()`)
3. Injeta o service no nó que consome a memória (via parâmetro)
4. Para CONTEXTUAL: pede o `Embedder` (provedor de embedding) e `dim`

### Padrão obrigatório
- CURTA não cria service — é campo no state do grafo
- LONGA/EPISÓDICA/CONTEXTUAL: instanciados só no `factory.ts`
- `limiar`/`max_fragmentos` lidos da política, nunca hardcoded (Configuration as Code)
- Injeção de contexto no system prompt via `getContextForPrompt(userId)`
- Subir Postgres: `docker-compose up -d postgres`

### ERRADO ❌
```typescript
const mem = new ContextualMemoryService(embed, { limiar: 0.5, maxFragmentos: 20 }, 1536) // ❌ política hardcoded no nó
```
### CORRETO ✅
```typescript
// factory.ts — lê do contrato memory.md
const contract = loadMemoryContract('memory.md')
const ctx = new ContextualMemoryService(embed, {
  limiar: contract.memorias.contextual.limiar,
  maxFragmentos: contract.memorias.contextual.max_fragmentos,
}, 1536)
```

### Checklist
- [ ] Tipo `enabled: true` no `memory.md`
- [ ] Service instanciado só no `factory.ts`
- [ ] Política lida do contrato, não hardcoded
- [ ] Contrato de eval prova ganho (BOA) e ausência de IRRELEVANTE/PERIGOSA

## Avaliar memória (harness)

Judges em `judges.ts`: `memory_relevance` (BOA), `memory_concision` (IRRELEVANTE).
Contrato: `packages/harness/src/contracts/memoria.yaml` — cases em sequência no mesmo
`EVAL_SCOPE_ID` (1º popula, seguintes recuperam). `evals/run.ts` põe o `memoryContext`
no início do `reasoningText`; os judges avaliam via canal `reasoning`.

```bash
docker-compose up -d postgres
cd presets/react/apps/api
npm run eval -- ../../../../packages/harness/src/contracts/memoria.yaml
```
