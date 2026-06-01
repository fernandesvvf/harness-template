# Guia Prático — Manipular Contratos, Evals e Benchmarks

Tutorial hands-on. Cada seção: o que é, como criar/editar, como rodar. Exemplos copiáveis.

> Conceitos (por quê de cada coisa): [learning.md](./learning.md) §3.
> Diagrama do harness: [harness-architecture.md](./harness-architecture.md).
> Skills que automatizam: `/craft-contract`, `/craft-dataset`, `/tune-suite`.

Onde tudo vive:
```
packages/harness/src/contracts/*.yaml   contratos (judges)
packages/harness/evals/datasets/*.json  datasets (ground-truth)
packages/harness/evals/suites/*.yaml     suites (gate)
packages/harness/evals/resultados/*.json saída (gerada)
```
Rodar sempre de dentro de um preset: `cd presets/react/apps/api`.

---

## 1. Contrato (qualidade via LLM-judge)

**Quando:** avaliar comportamento subjetivo ("a resposta é boa/completa/segura?").

### Criar
`packages/harness/src/contracts/minha_capability.yaml`:
```yaml
name: "minha capability"
description: "o que o agente deve fazer"
runs: 1                       # >1 = média (agente é não-determinístico)
cases:
  - id: happy_path
    variation: happy_path
    input: "pergunta ideal"
    assertions:
      tool_calls:
        - { tool: buscar_produto, required: true, params: { nome: "contains:X" } }
        - { tool: finalizar_pedido, expect_called: false }   # NÃO pode chamar
      tool_count: { max: 3 }
      reasoning: { judge: reasoning_relevance, min_score: 0.7 }
      output:    { judge: answer_completeness, min_score: 0.8, contains: ["preço"] }
  # repita pras 5 variações: edge_case, adversarial, ambiguous, wrong_tool_temptation
```

**Assertions disponíveis:**
| Campo | Faz |
|---|---|
| `tool_calls[].required` | a tool DEVE ter sido chamada |
| `tool_calls[].expect_called: false` | a tool NÃO pode ser chamada |
| `tool_calls[].params` | `"contains:x"` (substring) ou valor exato |
| `tool_count.max` | teto de tools chamadas |
| `reasoning.judge` / `output.judge` | nota LLM (judges em `judges.ts`) |
| `output.contains` | substrings que devem aparecer |

**Judges existentes:** `reasoning_relevance`, `answer_completeness`, `asks_clarification`,
`no_error_exposed`, `memory_relevance`, `memory_concision`. Pra criar: edite `JUDGE_PROMPTS` em `judges.ts`.

### Rodar
```bash
npm run eval -- ../../../../packages/harness/src/contracts/minha_capability.yaml
```

---

## 2. Dataset (acerto objetivo, sem LLM)

**Quando:** medir acerto com gabarito (acertou a tool? lembrou o fato?). 3 tipos.

### Criar — `packages/harness/evals/datasets/<nome>_cases.json`

**tool_selection** (escolha de ferramenta):
```json
{ "tipo": "tool_selection",
  "casos": [
    { "id": "ts-001", "entrada": "...", "tools_esperadas": ["buscar_logs"], "tools_proibidas": ["reiniciar_servico"] }
  ] }
```

**behavior** (decisão/resposta):
```json
{ "tipo": "behavior",
  "casos": [
    { "id": "bh-001", "entrada": "...", "deve_conter": ["deploy"], "nao_deve_conter": ["senha"], "resultado_esperado": "deploy" }
  ] }
```

**memory_impact** (ground-truth da memória — array direto):
```json
[ { "id": "mem-001", "entrada": "...",
    "contexto_esperado": { "fatos_relevantes": [], "episodios_relevantes": [], "licoes_relevantes": [] },
    "decisao_esperada": "...", "resultado_esperado": "..." } ]
```

**Regras:** 1 dataset = 1 tipo. Inclua caso adversarial/vazio (mede que NÃO traz lixo).

### Rodar
```bash
npm run eval:datasets -- ../../../../packages/harness/evals/datasets/<nome>_cases.json
```
Scores = nomes das fórmulas dos scorers (ex: `tools_esperadas_ok`, `contem_deploy`, `precision_memoria`).

---

## 3. Suite (gate — passa/falha)

**Quando:** transformar scores em barreira de CI (PR falha se a qualidade cair).

### Criar — `packages/harness/evals/suites/<nome>.yaml`
```yaml
nome: tool_selection
dataset: ../datasets/tool_selection_cases.json
limiares:
  tools_esperadas_ok: { min: 0.8 }              # piso
  nao_chamou_reiniciar_servico: { min: 1.0 }    # segurança: sempre 1.0
  hallucination_from_memory: { max: 0.05 }      # teto (menor é melhor)
```
**Os nomes dos limiares = os nomes dos scores** que aparecem ao rodar o dataset.

### Rodar (gate)
```bash
npm run eval:suite -- ../../../../packages/harness/evals/suites/<nome>.yaml
echo $?     # 0 = passou ; 1 = violou limiar
```
Salva `evals/resultados/<nome>.json` (histórico — compare versões).

### Calibrar limiares
Não chute. Rode uma vez, veja os scores, ponha `min` ~0.1 abaixo do medido (margem p/
não-determinismo); métricas de segurança = 1.0. Ou use `/tune-suite <nome>`.

---

## 4. Memory-impact (a memória ajudou?)

**Quando:** provar que lembrar melhora (roda cada caso com E sem memória).

Usa a suite `memory_impact_eval.yaml` (tem `thresholds` próprios). Métricas:
`retrieval_precision/recall`, `memory_utilization`, `hallucination_from_memory`,
`decision_improvement` (menos passos com memória), `lesson_quality`.

```bash
docker-compose up -d postgres     # precisa de memória
npm run eval:memory -- ../../../../packages/harness/evals/suites/memory_impact_eval.yaml
```
`MEMORY_DISABLED=1` (lido no factory) é o baseline — o runner alterna automaticamente.

---

## 5. Benchmark (comparar arquiteturas)

**Quando:** decidir react vs plan-execute vs reflection com dados (tokens/tempo).

```bash
# da RAIZ do workspace:
export $(grep -v '^#' presets/react/apps/api/.env | xargs)   # carrega OPENROUTER_API_KEY
npm run benchmark -- packages/harness/evals/datasets/behavior_cases.json
```
Gera `benchmarks/report.md` com tabela + veredito (mais eficiente/rápido/cobertura).

---

## Fluxo recomendado (spec-driven)

```
/craft-spec → escreve o spec (O QUÊ + 5 variações)
   ↓
/craft-contract  (deriva o contrato do spec)   ou   /craft-dataset (ground-truth)
   ↓
roda eval / eval:datasets → vê os scores
   ↓
/tune-suite  (calibra limiares a partir dos scores reais)
   ↓
eval:suite no CI  (gate)  +  benchmark (escolher arquitetura)
```

## Armadilhas (de KNOWN_ISSUES)
- `--env-file` não sobrescreve var já exportada no shell → `unset` se preciso.
- Langfuse: precisa das keys no `.env` (opcional; sem elas, evals rodam sem trace).
- Dado de teste literal: o catálogo de exemplo usa minúsculas ("produto x") — alinhe os inputs.
