# Contrato de Memória — plan-execute preset

Validado por `@harness/memory`. Carregado pelo `factory.ts`.

**Plan-execute usa só memória por FILTRO** (LONGA + EPISÓDICA-resumo). Sem CONTEXTUAL
(busca semântica é p/ caminho aberto, não p/ fluxo previsível) e sem reflexão evolutiva.
Por padrão só **CURTA** está ligada. `recall`/`persist` existem mas só atuam com `enabled: true`.

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
guardrails → recall → planner → executor* → synthesizer → evaluate → persist → END
             (recuperar)  (planejar) (agir)   (perceber)   (avaliar) (persistir)
```

Para ligar memória: `enabled: true` + `docker-compose up -d postgres`. O `recall`
injeta o contexto no `planner`; o `persist` grava fatos/resumo/lição ao fim.
