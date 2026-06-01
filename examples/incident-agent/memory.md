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

  # EPISÓDICA — resumos de execuções. Gravada no nó persist, lida no recall.
  episodica:
    tipo: arquivo
    enabled: true
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
guardrails → recall → agent ⇄ tools → persist → END
              │                          │
   LEITURA    │                          │  ESCRITA
   ├ LONGA: getContextForPrompt(scopeId) ├ LONGA: LLM extrai fatos duráveis → upsert
   ├ EPISÓDICA: resumos recentes         ├ EPISÓDICA: LLM resume execução → store(runId)
   └ CONTEXTUAL: query(question,scopeId) └ CONTEXTUAL: indexa resposta final
        ↓ memoryContext no system prompt
```

- `scopeId` vem no body do `/chat` (default `global`). Genérico: chat manda `userId`,
  automação manda `tenant`/`job`. `runId` é gerado por execução.
- Leitura no nó **recall** (antes do agent); escrita no nó **persist** (antes do END).
- Subir Postgres+pgvector: `docker-compose up -d postgres`.
- Ajustar `limiar`/`max_fragmentos`/`ttl_dias` aqui muda comportamento sem tocar código.

## Medir (cenários da aula)

| Cenário | Como detectar | Política |
|---|---|---|
| BOA | resolve em menos passos com a memória | objetivo |
| IRRELEVANTE | fragmentos inúteis no prompt | baixar `max_fragmentos` / subir `limiar` |
| PERIGOSA | fato desatualizado em LONGA | revisar/expirar o fato |
