---
description: Lê um spec e deriva a lista de tasks (quais craft-skills rodar, em que ordem) no TodoWrite
argument-hint: <capability>
---

## Contexto
Ponte entre o spec (O QUÊ) e a implementação. Lê `specs/<capability>.spec.md` e
deriva o SUBCONJUNTO de craft-skills necessárias + ordem, baseado no que o spec declara
(nós LLM vs I/O, tools, memória, novos campos de estado). Saída: tasks no TodoWrite.
Referência: `skills/craft.md` (pipeline), `spec.template.md`, `PATTERNS.md` P17.

## Perguntas (uma por vez)
1. Qual capability? (deve existir `specs/<capability>.spec.md`) — se não existe, sugerir `/craft-spec` antes.

## Como derivar (regras)

Lê o spec e mapeia cada elemento para a craft-skill correspondente:

| Elemento no spec | Task derivada |
|---|---|
| toda capability | `/craft-prompt` (system/user prompt + schema) |
| nó que chama LLM | `/craft-llm-node` |
| nó de I/O sem LLM (DB/API/tool por nome) | `/craft-io-node` |
| nova rota condicional | `/craft-edge-conditions` |
| novos campos de estado / nó no grafo | `/craft-graph-state` |
| nova dependência de infra | `/craft-factory` |
| memória LONGA/EPISÓDICA/CONTEXTUAL usada | `/craft-memory <tipo>` (1 por tipo) |
| sempre, ao fim | `/craft-contract` (deriva das 5 variações do spec) |

Ordem fixa do pipeline (omita os passos que o spec não exige):
```
craft-prompt → craft-*-node → craft-edge-conditions → craft-graph-state
  → craft-factory → craft-memory* → craft-contract
```

## Padrão Obrigatório

### CORRETO ✅
- Cada task referencia a seção do spec que a originou (rastreável).
- Só inclui craft-skills que o spec realmente exige (não o pipeline inteiro por padrão).
- Última task sempre `/craft-contract` + `npm run eval`.
- Gera no TodoWrite (some quando feito; não polui o repo).

### ERRADO ❌
- Listar o pipeline fixo inteiro ignorando o spec. // ❌ vira ruído (= craft.md)
- Gerar tasks sem spec existente. // ❌ sem âncora; rode /craft-spec antes
- Inventar tasks fora das craft-skills. // ❌ saída deve ser executável pelas skills

## Passos de Execução
1. Ler `specs/<capability>.spec.md`. Se não existir, parar e sugerir `/craft-spec`.
2. Mapear elementos do spec → craft-skills (tabela acima).
3. Ordenar pelo pipeline fixo, omitindo o que não se aplica.
4. Emitir as tasks no TodoWrite, cada uma citando a seção do spec.
5. Última task: `/craft-contract <capability>` + rodar `npm run eval`.

## Checklist de Saída
- [ ] Spec lido e existente
- [ ] Só craft-skills exigidas pelo spec na lista
- [ ] Ordem segue o pipeline fixo
- [ ] Memória incluída só se o spec usa
- [ ] Última task = contrato + eval
- [ ] Tasks no TodoWrite, rastreáveis ao spec
