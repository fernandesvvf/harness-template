# Contrato de Memória — reflection preset

Validado por `@harness/memory`. Carregado pelo `factory.ts`.

Reflection usa o **kit completo** de memória — combina forte com reflexão evolutiva
(o `critic` reprova → vira lição). Por padrão só **CURTA**; ligue os outros conforme precisar.

## Política

```yaml
memorias:
  curta:
    tipo: local
    enabled: true

  longa:
    tipo: arquivo
    enabled: false
    store: pg

  episodica:
    tipo: arquivo
    enabled: false
    store: pg
    ttl_dias: 30

  contextual:
    tipo: embedding
    enabled: false
    store: pgvector
    limiar: 0.78
    max_fragmentos: 5
```

## Ciclo neste preset

```
guardrails → recall → generator ⇄ critic → persist → END
             (recuperar)  (gerar)   (AVALIAR)  (persistir)
```

- `recall` injeta fatos/lições passadas no `generator`.
- `critic` é a fase **avaliar** (não precisa de nó evaluate separado).
- `persist`: se o critic reprovou até o teto, extrai **lição** (reflexão evolutiva).
- `npm run consolidate-lessons -- <scopeId>` consolida padrões → LONGA.
