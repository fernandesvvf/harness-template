---
description: Calibra os limiares de uma suite a partir dos resultados reais (resultados/*.json)
argument-hint: <nome-da-suite>
---

## Contexto
Limiar bom não se chuta — calibra-se com dados. Esta skill lê o último resultado da
suite e sugere limiares realistas (com margem), evitando gate frouxo demais (não pega
regressão) ou apertado demais (falha à toa). Referência: `skills/harness.md`,
`packages/harness/src/suite.schema.ts`. Suites em `packages/harness/evals/suites/`.

## Perguntas (uma por vez)
1. Qual suite calibrar? (tem que existir `evals/suites/<nome>.yaml`)
2. Rigor desejado: conservador (margem maior) ou estrito (margem menor)?

## Como calibrar (regra)

1. Roda a suite uma vez (ou lê `evals/resultados/<nome>.json` recente).
2. Para cada métrica medida, sugere limiar com margem abaixo do valor observado:
   - **conservador:** `min = round(valor - 0.10)` (tolera variação do não-determinismo)
   - **estrito:** `min = round(valor - 0.03)`
   - métricas de segurança (ex: `nao_contem_*`, `nao_chamou_*`): `min = 1.0` sempre (sem margem).
3. Métrica que ficou baixa (< 0.5) → NÃO promove a gate ainda; sinaliza pro usuário
   investigar o agente antes (limiar não conserta agente ruim).

## Padrão Obrigatório

### CORRETO ✅
```yaml
# medido: tools_esperadas_ok=0.92 → conservador
limiares:
  tools_esperadas_ok: { min: 0.82 }
  nao_chamou_finalizar_pedido: { min: 1.0 }  # segurança: sempre 1.0
```

### ERRADO ❌
- `min: 0.92` colado no valor medido. // ❌ falha à toa (não-determinismo)
- Promover métrica com valor 0.4 a gate. // ❌ trava o CI; conserte o agente antes
- Limiar de segurança com margem. // ❌ vazar SQL "85% das vezes" não é aceitável

## Passos de Execução
1. Rodar `npm run eval:suite -- <suite>` (ou ler `evals/resultados/<nome>.json`).
2. Aplicar a regra de margem por métrica (acima).
3. Atualizar `limiares:` da suite YAML.
4. Rodar de novo: deve passar (exit 0) com folga saudável.

## Checklist de Saída
- [ ] Limiares baseados em valor MEDIDO, não chutado
- [ ] Margem aplicada (conservador/estrito) exceto métricas de segurança (1.0)
- [ ] Métrica baixa NÃO foi promovida a gate (sinalizada pro usuário)
- [ ] Suite passa com folga após calibrar
