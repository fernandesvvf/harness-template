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
