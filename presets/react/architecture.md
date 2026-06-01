# Arquitetura — ReAct

**Ideia:** loop raciocínio↔ação. A cada passo o LLM decide chamar uma tool ou responder;
o resultado da tool volta pro LLM. Cobre o ciclo completo + memória + avaliação.

## Grafo

```mermaid
flowchart TD
    START([START]) --> guardrails
    guardrails{guardrails<br/>seguro?}
    guardrails -- não --> blocked[blocked] --> END([END])
    guardrails -- sim --> recall

    recall[recall<br/>recuperar contexto<br/>LONGA + EPISÓDICA + CONTEXTUAL]
    recall --> agent

    agent[agent<br/>perceber + planejar + agir<br/>LLM + tools]
    agent -->|tool_calls + budget| tools[tools<br/>ToolNode]
    tools --> agent
    agent -->|sem tool_calls<br/>ou teto REACT_MAX_STEPS| evaluate

    evaluate[evaluate<br/>auto-avaliação fail-open]
    evaluate -->|memória ligada| persist[persist<br/>fatos + resumo + lição]
    evaluate -->|sem memória| END
    persist --> END
```

## Fases do ciclo → nós

| Fase | Nó | Observação |
|---|---|---|
| recuperar contexto | `recall` | filtro (LONGA/EPISÓDICA) + semântica (CONTEXTUAL) |
| perceber + planejar + agir | `agent` ⇄ `tools` | ReAct funde as 3 no loop |
| avaliar | `evaluate` | fail-open: registra score, nunca bloqueia |
| persistir | `persist` | extrai fato/resumo; lição se inesperado |

## Quando usar
Caminho aberto, ramificações, debugging. Resultado de um passo muda o próximo.
**Teto:** `REACT_MAX_STEPS` (guarda alucinação por contexto longo).

## Evals deste preset

```mermaid
flowchart LR
    subgraph contrato["contrato (judges)"]
      c[buscar_produto.yaml] --> cr[npm run eval]
    end
    subgraph dataset["dataset (objetivo)"]
      d[tool_selection / behavior] --> dr[npm run eval:datasets]
    end
    subgraph suite["suite (gate)"]
      s[limiares] --> sr[npm run eval:suite<br/>exit≠0 se violar]
    end
    subgraph memimpact["memory-impact"]
      m[com vs sem memória] --> mr[npm run eval:memory<br/>decision_improvement]
    end
```

| Modo | Comando | Mede |
|---|---|---|
| Contrato | `npm run eval` | qualidade (LLM-judge) |
| Dataset | `npm run eval:datasets` | acerto objetivo (tools/output) |
| Suite | `npm run eval:suite` | gate (passa/falha) |
| Memory-impact | `npm run eval:memory` | a memória ajudou? |

Datasets/suites compartilhados em `packages/harness/evals/`. Observabilidade: toda run
(`/chat` + evals) traça no Langfuse. Detalhes em [docs/harness-architecture.md](../../docs/harness-architecture.md).
