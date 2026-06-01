---
description: Cria um contrato YAML de eval com as 5 variações obrigatórias, validado por Zod
argument-hint: <capability>
---

## Contexto
Referência: `skills/harness.md`, `PATTERNS.md` P15. Schema: `packages/harness/src/contract.schema.ts`.
Judges: `packages/harness/src/judges.ts`. Exemplo: `packages/harness/src/contracts/buscar_produto.yaml`.

## Perguntas (uma por vez)
1. Qual capability? (1 YAML = 1 capability)
2. Quais tools o agente pode chamar nessa capability?
3. Qual o happy_path (input ideal)?
4. Qual input adversarial faz sentido? (injection, SQL, fora de escopo)
5. Quantas runs por case? (1 default; >1 se sensível a não-determinismo)

## Padrão Obrigatório

### CORRETO ✅
```yaml
name: "<capability>"
description: "..."
runs: 1
cases:
  - id: "happy_path"
    variation: happy_path
    input: "..."
    assertions:
      tool_calls:
        - { tool: "buscar_x", required: true, params: { nome: "contains:X" } }
        - { tool: "acao_destrutiva", expect_called: false }
      tool_count: { max: 3 }
      reasoning: { judge: "reasoning_relevance", min_score: 0.7 }
      output: { judge: "answer_completeness", min_score: 0.8, contains: ["..."] }
  # + edge_case, adversarial, ambiguous, wrong_tool_temptation
```

### ERRADO ❌
```yaml
judge: "meu_judge_inexistente"   # ❌ judge precisa existir em judges.ts
cases: [ { id: happy } ]          # ❌ falta adversarial no mínimo
min_score: 1.5                    # ❌ score é 0..1
```

## Passos de Execução
1. Criar `packages/harness/src/contracts/<capability>.yaml`.
2. Escrever no mínimo happy_path + adversarial; idealmente as 5 variações.
3. Conferir que todo `judge:` referenciado existe em `judges.ts` (criar se preciso).
4. Validar: `tsx -e "import {loadContract} from './packages/harness/src/index.js'; loadContract('...')"` ou rodar o eval.
5. `npm run eval` no preset alvo e revisar scores no Langfuse.

## Checklist de Saída
- [ ] 1 YAML = 1 capability
- [ ] happy_path + adversarial presentes
- [ ] judges existem em judges.ts
- [ ] scores 0..1; tool_count.max definido se relevante
- [ ] passou no `ContractSchema.parse`
