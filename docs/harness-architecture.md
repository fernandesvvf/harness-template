# Arquitetura do Harness

O harness é a infraestrutura que **executa e valida** o agente — não o agente em si.
Engloba: spec (contratos/datasets/suites) → runners → scoring → observabilidade.

## Visão geral

```mermaid
flowchart TB
    subgraph spec["SPEC — o que avaliar (texto/YAML/JSON)"]
      contratos[contracts/*.yaml<br/>comportamento por capability]
      datasets[datasets/*.json<br/>ground-truth: memory/tool/behavior]
      suites[suites/*.yaml<br/>dataset + limiares]
    end

    subgraph runners["RUNNERS — executam o agente"]
      runner[runner.ts<br/>contrato]
      dsrunner[dataset-runner.ts]
      suiterunner[suite-runner.ts<br/>GATE: exit≠0]
      memrunner[memory-eval-runner.ts<br/>com vs sem memória]
      bench[benchmark-runner.ts<br/>N arquiteturas]
    end

    subgraph scoring["SCORING — dão nota"]
      judges[judges.ts<br/>LLM-as-judge]
      scorers[scorers.ts + memory-eval.ts<br/>funções PURAS 0..1]
    end

    subgraph obs["OBSERVABILIDADE"]
      tracer[tracer.ts<br/>Langfuse: traces+scores]
      meter[token-meter.ts<br/>custo]
    end

    preset[["preset.invoke<br/>InvokeForDataset / InvokeAgent"]]

    contratos --> runner
    datasets --> dsrunner
    suites --> suiterunner
    suites --> memrunner
    datasets --> bench

    runner & dsrunner & suiterunner & memrunner & bench --> preset
    runner --> judges
    dsrunner & suiterunner & memrunner --> scorers
    bench --> meter
    runner & dsrunner & suiterunner & bench --> tracer
```

## Como o preset se liga (DI)

O harness **não importa** nenhum preset. Cada preset implementa `InvokeForDataset` /
`InvokeForBenchmark` / `InvokeMemoryEval` (em `presets/*/apps/api/evals/`) e injeta no runner.
Por isso o mesmo harness serve react, plan-execute, reflection.

```mermaid
flowchart LR
    p[preset evals/run-*.ts] -->|injeta invoke| r[runner do harness]
    r -->|callbacks| g[grafo do preset]
    g -->|Observed/RunResult| r
    r --> sc[scorers] --> rep[scores + report + Langfuse]
```

## Os 5 modos

| Modo | Runner | Scoring | Saída |
|---|---|---|---|
| Contrato | `runner` | judges (LLM) | scores por case |
| Dataset | `dataset-runner` | scorers (puros) | scores objetivos |
| Suite | `suite-runner` | scorers + limiares | **gate** (exit≠0) + `resultados/*.json` |
| Memory-impact | `memory-eval-runner` | memory-eval (com vs sem) | decision_improvement etc |
| Benchmark | `benchmark-runner` | tokens/tempo/cobertura | `benchmarks/report.md` |

Regra: contrato/dataset/memory-impact **medem** · suite **decide** · benchmark **compara**.

## Estrutura de arquivos

```
packages/harness/src/
  contract.schema.ts    valida contrato YAML
  dataset.schema.ts     valida dataset JSON (3 tipos)
  suite.schema.ts       valida suite YAML
  runner.ts             contrato → judges
  dataset-runner.ts     dataset → scorers
  suite-runner.ts       suite → gate + resultados/
  memory-eval-runner.ts com vs sem memória
  benchmark-runner.ts   N arquiteturas → report
  scorers.ts            scoreMemory/Tool/Behavior (puros)
  memory-eval.ts        6 métricas de impacto (puras)
  judges.ts             LLM-as-judge
  tracer.ts             Langfuse
  token-meter.ts        custo
  evals/datasets|suites|resultados/   dados compartilhados pelos presets
```

Conceitos: [learning.md](./learning.md) §3. Como manipular: [skills/harness.md](../skills/harness.md).
Trocar de stack: [PORTING.md](../PORTING.md).
