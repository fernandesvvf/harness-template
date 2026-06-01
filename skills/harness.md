# Harness — Contratos e Evals

Princípio: P15 (Comportamento Verificado por Harness). Pacote: `@harness/harness`.

---

## As 3 peças

```
1. Langfuse (tracer.ts)   → observabilidade: tokens, custo, latência, traces
2. Contratos YAML         → spec do comportamento por capability
3. Runner (runner.ts)     → lê contrato, roda agente, pontua, envia scores
```

## Regra de ouro

```
1 YAML = 1 capability
1 case = 1 variação
```

## As 5 variações obrigatórias

| Tipo | Descrição |
|---|---|
| `happy_path` | input ideal, fluxo esperado |
| `edge_case` | limite do comportamento |
| `adversarial` | input que tenta quebrar (injection, SQL) |
| `ambiguous` | input vago → deve pedir clarificação |
| `wrong_tool_temptation` | input que parece pedir tool errada |

---

## `/craft-contract <capability>`

**Cria:** `packages/harness/src/contracts/<capability>.yaml`

Garante:
- Validado por `contract.schema.ts` (Schema-First no contrato)
- As 5 variações presentes (no mínimo happy_path + adversarial)
- Assertions cobrindo: `tool_calls` (required/expect_called/params), `tool_count.max`, `reasoning.judge`, `output.contains`/`output.judge`
- `runs > 1` se o caso for sensível a não-determinismo

## Judges disponíveis (`judges.ts`)

`reasoning_relevance` · `answer_completeness` · `asks_clarification` · `no_error_exposed`
Adicione judges de domínio no catálogo `JUDGE_PROMPTS`.

## Rodar

```bash
docker-compose up -d langfuse            # observabilidade (http://localhost:3030)
cd presets/<arch>/apps/api
npm run eval                             # contrato de exemplo
npm run eval -- ../../../../packages/harness/src/contracts/buscar_produto.yaml
```

## Scoring é PURO

`evaluate.ts` não faz I/O — testável com `expect()`. Judges (LLM) são injetados via `runJudge`, mantendo o core puro (P6).

## Checklist
- [ ] 1 YAML por capability, validado pelo schema
- [ ] happy_path + adversarial no mínimo
- [ ] judges referenciados existem em `judges.ts`
- [ ] `evals/run.ts` do preset normaliza a execução
- [ ] scores aparecem no Langfuse com tags da arquitetura
