---
description: Cria/edita um dataset de eval (memory_impact | tool_selection | behavior) validado pelo schema
argument-hint: <memory|tool|behavior> <nome>
---

## Contexto
Datasets têm ground-truth por dimensão → score objetivo (sem judge). 3 tipos, cada um
com schema próprio. Referência: `packages/harness/src/dataset.schema.ts`, `skills/harness.md`.
Saída: `packages/harness/evals/datasets/<nome>_cases.json`.

## Perguntas (uma por vez)
1. Qual tipo? (memory_impact | tool_selection | behavior)
2. Quantos casos e quais entradas (em linguagem natural)?
3. Por caso, o ground-truth do tipo (ver abaixo).

## Ground-truth por tipo (o que preencher)

**memory_impact** — mede recall da memória:
```json
{ "id": "...", "entrada": "...",
  "contexto_esperado": { "fatos_relevantes": [], "episodios_relevantes": [], "licoes_relevantes": [] },
  "resultado_esperado": "..." }
```

**tool_selection** — mede escolha de ferramenta:
```json
{ "id": "...", "entrada": "...",
  "tools_esperadas": ["buscar_produto"], "tools_proibidas": ["finalizar_pedido"] }
```

**behavior** — mede decisão/resposta:
```json
{ "id": "...", "entrada": "...",
  "deve_conter": ["preço"], "nao_deve_conter": ["DROP TABLE","SQL"],
  "resultado_esperado": "..." }
```

## Padrão Obrigatório

### CORRETO ✅
- `tipo` no topo + `casos: [...]` (discriminated union).
- Ground-truth realista: itens esperados que de fato aparecem no domínio.
- memory_impact: incluir 1 caso com contexto VAZIO (mede que NÃO recupera lixo → IRRELEVANTE).
- tool_selection: sempre declarar `tools_proibidas` quando houver pega-ratoeira.

### ERRADO ❌
- Misturar tipos no mesmo arquivo. // ❌ 1 dataset = 1 tipo
- Ground-truth genérico que sempre passa. // ❌ não mede nada
- Esquecer o caso adversarial/vazio. // ❌ só mede happy path

## Passos de Execução
1. Criar `packages/harness/evals/datasets/<nome>_cases.json` com o `tipo` certo.
2. Preencher os casos com ground-truth (tabelas acima).
3. Validar: `loadDataset(path)` (lança se inválido) ou rodar `eval:datasets`.
4. (opcional) Criar/atualizar a suite correspondente — ver `/tune-suite`.

## Checklist de Saída
- [ ] 1 dataset = 1 tipo, validado pelo `DatasetSchema`
- [ ] ground-truth realista por caso
- [ ] caso vazio/adversarial presente conforme o tipo
- [ ] roda em `npm run eval:datasets -- <arquivo>`
