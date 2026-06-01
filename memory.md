# Contrato de Memória

> Slide da aula: "O contrato `memory.md` governa os 4 tipos. Cada um declara sua política."

Este arquivo é a **fonte da verdade** sobre o que o agente lembra e por quanto tempo.
Validado por `@harness/memory` (`memory.schema.ts`) — política inválida falha antes de rodar.

Copie este arquivo pra raiz de cada projeto e ajuste o bloco `yaml` abaixo.

## Política

```yaml
memorias:
  # CURTA — "mesa de trabalho": estado da execução atual. Morre com a execução.
  # Vive no state do grafo (messages); não tem service nem persistência.
  curta:
    tipo: local
    enabled: true

  # LONGA — "caderno": fatos confirmados do domínio. Persiste sempre.
  longa:
    tipo: arquivo
    enabled: false
    store: pg

  # EPISÓDICA — "diário": resumos de execuções passadas. Tempo configurável.
  episodica:
    tipo: arquivo
    enabled: false
    store: pg
    ttl_dias: 30      # null = nunca expira

  # CONTEXTUAL — "google interno": fragmentos por similaridade. Sob demanda.
  contextual:
    tipo: embedding
    enabled: false
    store: pgvector
    limiar: 0.78         # < limiar = descartado (guarda cenário IRRELEVANTE)
    max_fragmentos: 5    # teto por consulta (guarda cenário IRRELEVANTE)
```

## Dois modos de buscar memória

A aula distingue duas formas de recuperar — cada tipo usa a sua:

| Modo | Como busca | Tipos que usam | Quando |
|---|---|---|---|
| **Filtro** | igualdade exata (`WHERE scope_id = ...`) | LONGA, EPISÓDICA | você sabe a chave; quer tudo daquele escopo |
| **Significado (semântica)** | similaridade de embedding (`<=>` cosseno) | CONTEXTUAL | você tem uma pergunta; quer o que for *parecido* |

Filtro é determinístico e barato. Semântica acha o relevante sem chave exata, mas precisa de limiar pra não trazer ruído (cenário IRRELEVANTE). No preset react, o nó `recall` combina os dois: filtro pra LONGA/EPISÓDICA + semântica pra CONTEXTUAL.

## Os 3 cenários (slide) — por que medir

| Cenário | O que acontece | Política que mitiga |
|---|---|---|
| **BOA** | memória ajudou (resolve em menos passos) | objetivo |
| **IRRELEVANTE** | fragmentos inúteis poluem o contexto, gastam tokens | `limiar`, `max_fragmentos` |
| **PERIGOSA** | fato desatualizado → diagnóstico errado | `ttl_dias`, `purgeExpired()` |

> "Só medindo pra saber em qual cenário você está. Intuição não basta."
> A qualidade da memória é avaliada por contratos do harness — ver `skills/memory.md`.

## Como ligar um tipo

1. `enabled: true` no tipo desejado acima.
2. `/craft-memory <tipo>` — adiciona o service ao `factory.ts` do preset e injeta no nó que usa.
3. Suba o Postgres: `docker-compose up -d postgres`.
4. Escreva um contrato de eval que prove o ganho (cenário BOA) e a ausência de IRRELEVANTE/PERIGOSA.
