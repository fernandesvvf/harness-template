# Contrato de Memória — react preset

Política dos 4 tipos. Validado por `@harness/memory` (`memory.schema.ts`).
Carregado pelo `factory.ts` via `loadMemoryContract`.

## Política

```yaml
memorias:
  # CURTA — estado da execução (messages do grafo). Sempre ligada.
  curta:
    tipo: local
    enabled: true

  # LONGA — fatos confirmados do usuário. Persiste sempre. Tabela long_term_facts.
  longa:
    tipo: arquivo
    enabled: true
    store: pg

  # EPISÓDICA — resumos de execuções. Desligada neste preset.
  episodica:
    tipo: arquivo
    enabled: false
    store: pg
    ttl_dias: 30

  # CONTEXTUAL — fragmentos por similaridade (pgvector). Recuperados no nó recall.
  contextual:
    tipo: embedding
    enabled: true
    store: pgvector
    limiar: 0.78         # < limiar = descartado (guarda IRRELEVANTE)
    max_fragmentos: 5    # teto por consulta (guarda IRRELEVANTE)
```

## Como funciona neste preset

```
guardrails → recall → agent ⇄ tools → END
              │
              ├─ LONGA: getContextForPrompt(userId) → fatos conhecidos
              └─ CONTEXTUAL: query(question) → trechos relevantes (limiar aplicado)
                    ↓
              memoryContext injetado no system prompt do agent
```

- `userId` vem no body do `/chat` (default `demo`).
- Subir Postgres+pgvector: `docker-compose up -d postgres`.
- Ajustar `limiar`/`max_fragmentos` aqui muda o comportamento sem tocar código (Configuration as Code).

## Medir (cenários da aula)

| Cenário | Como detectar | Política |
|---|---|---|
| BOA | resolve em menos passos com a memória | objetivo |
| IRRELEVANTE | fragmentos inúteis no prompt | baixar `max_fragmentos` / subir `limiar` |
| PERIGOSA | fato desatualizado em LONGA | revisar/expirar o fato |
