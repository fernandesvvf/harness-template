# Harness — Contratos e Evals

Princípio: P15 (Comportamento Verificado por Harness). Pacote: `@harness/harness`.

---

## As 3 peças

```
1. Langfuse (tracer.ts)   → observabilidade: tokens, custo, latência, traces
2. Contratos YAML         → spec do comportamento por capability
3. Runner (runner.ts)     → lê contrato, roda agente, pontua, envia scores
```

## Dois estilos de eval (coexistem)

| Estilo | Arquivo | Score | Quando |
|---|---|---|---|
| **Contrato** | `contracts/*.yaml` | judges LLM + assertions | comportamento por capability (subjetivo, flexível) |
| **Dataset** | `evals/datasets/*.json` | **objetivo** vs ground-truth | impacto de memória, tool selection, behavior (mensurável) |

Dataset-driven (inspirado na aula): cada caso declara o ground-truth → scorer puro compara, sem LLM.

```
evals/datasets/memory_impact_cases.json   → recall de fatos/episódios/lições (vs contexto_esperado)
evals/datasets/tool_selection_cases.json  → tools_esperadas chamadas? tools_proibidas evitadas?
evals/datasets/behavior_cases.json        → decisão/resultado; deve_conter / nao_deve_conter
```

Scorers em `scorers.ts` (puros): `scoreMemory` (recall + precision por tipo — precision guarda IRRELEVANTE), `scoreToolSelection`, `scoreBehavior`. Runner: `dataset-runner.ts`. Schema: `dataset.schema.ts`.

```bash
cd presets/react/apps/api
npm run eval:datasets -- ../../../../packages/harness/evals/datasets/tool_selection_cases.json
```

O preset implementa `InvokeForDataset` (em `evals/run-datasets.ts`) expondo o `Observed`
(memória recuperada por tipo + tools chamadas + output).

Criar/editar datasets: **`/craft-dataset <tipo> <nome>`** (valida schema + ground-truth).

## Suites — gate de qualidade (dataset + limiares)

Uma **suite** amarra um dataset a **limiares** (min/max). É o contrato de qualidade:
define o que é passar/falhar. Viola limiar → exit != 0 (gate de CI/pre-push).

```
packages/harness/evals/
  suites/*.yaml       → nome + dataset + limiares (tool_selection, behavior, memory)
  resultados/*.json   → saída persistida (gitignored) — compara versão N vs N+1
suite.schema.ts · suite-runner.ts (runSuite: roda, agrega, checa limiar, salva)
```

```bash
cd presets/react/apps/api
npm run eval:suite -- ../../../../packages/harness/evals/suites/tool_selection.yaml
# exit 0 = aprovado ; exit 1 = violou limiar (falha o CI)
```

Os nomes dos limiares são os **scores agregados** (média 0..1) dos scorers.

Calibrar limiares com base em resultados reais: **`/tune-suite <nome>`** (não chute o min).

## Memory-impact eval — mede o IMPACTO da memória (com vs sem)

Datasets/suites medem o que a memória *recupera*. O memory-impact mede se ela *ajuda*:
roda cada caso **2x** (baseline `MEMORY_DISABLED=1` + com memória) e compara.

Métricas: `retrieval_precision`, `retrieval_recall`, `memory_utilization` (a resposta
usou o recuperado?), `hallucination_from_memory` (inventou citando memória?),
`decision_improvement` (menos etapas com memória — prova o cenário BOA), `lesson_quality`.

```
packages/harness/memory-eval.ts (scorers) + memory-eval-runner.ts (roda 2x/caso)
evals/suites/memory_impact_eval.yaml → dataset + thresholds
```

```bash
cd presets/react/apps/api
npm run eval:memory -- ../../../../packages/harness/evals/suites/memory_impact_eval.yaml
```

`MEMORY_DISABLED=1` (lido no `factory.ts`) desliga toda a memória → é o baseline.

## Benchmark comparativo de arquiteturas

Roda o MESMO dataset nos 3 presets e compara **com dados** (fecha o P14). Métricas:
taxa de conclusão, **tokens** (custo), tempo, cobertura de ferramentas.

```
packages/harness/
  token-meter.ts       → coleta tokens por execução (OpenRouterService reporta)
  benchmark-runner.ts  → runBenchmark(arch, dataset, invoke) + gerarReport(report.md)
scripts/benchmark.ts   → orquestra react + plan-execute + reflection
benchmarks/report.md   → saída comparativa (gerada) com veredito
```

```bash
npm run benchmark                         # dataset behavior_cases.json
npm run benchmark -- caminho/dataset.json
```

O report marca o melhor por métrica em **negrito** + veredito (mais eficiente/rápido/cobertura).
Tokens vêm do `usage_metadata` de cada chamada LLM (instrumentado no `OpenRouterService`).

**Langfuse (opcional):** se as chaves estiverem configuradas, cada caso gera um trace
com tag da arquitetura (`benchmark`, `react`/`plan`/`reflection`, caso) + scores (tokens,
tempo, conclusão, cobertura) — dá pra comparar os 3 no dashboard. Sem chaves, roda igual
(token-meter local). O `report.md` é gerado dos dois jeitos.

## Regra de ouro (contratos)

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
