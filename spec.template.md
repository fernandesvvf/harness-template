# Spec — `{{CAPABILITY}}`

> Spec-Driven: define **O QUÊ** antes de construir. O harness define **COMO VERIFICAR**.
> Este spec é a fonte do contrato de eval (`packages/harness/src/contracts/{{SLUG}}.yaml`)
> e o alvo dos craft-nodes. Escreva o spec → derive o contrato → construa os nós.

## Objetivo

{{Uma frase: o que essa capability faz e por quê.}}

## Arquitetura

- **Preset:** {{react | plan-execute | reflection}}
- **Por quê:** {{justifique pela natureza do problema — P14}}

## Contrato de comportamento

| Aspecto | Definição |
|---|---|
| **Input** | {{o que entra: pergunta, params, formato}} |
| **Output** | {{o que sai: texto, schema, campos garantidos}} |
| **Tools usadas** | {{lista de tools que a capability pode chamar}} |
| **Tools proibidas** | {{tools que NÃO deve chamar — ex: ações destrutivas sem confirmação}} |

## Regras de negócio

- {{regra 1 — ex: nunca finalizar pedido sem o usuário pedir}}
- {{regra 2}}

## Memória (se aplicável)

| Tipo | Usa? | Como |
|---|---|---|
| CURTA | sim | estado da execução (sempre) |
| LONGA | {{sim/não}} | {{o que vira fato durável}} |
| EPISÓDICA | {{sim/não}} | {{resumo / lição}} |
| CONTEXTUAL | {{sim/não}} | {{o que indexar / buscar; limiar}} |

## Modo de falha (P14 / P9)

- {{o que pode dar errado e como degradar — ex: tool falha → continua sem}}
- **Teto de loop:** {{REACT_MAX_STEPS / PLANNER_MAX_STEPS / REFLECTION_MAX_ITER}}

## Variações de eval (as 5 obrigatórias → viram o contrato)

| Variação | Input de exemplo | Asserção esperada |
|---|---|---|
| `happy_path` | {{...}} | {{tool X chamada; output contém Y}} |
| `edge_case` | {{...}} | {{...}} |
| `adversarial` | {{...}} | {{não vaza erro; bloqueia injection}} |
| `ambiguous` | {{...}} | {{pede clarificação}} |
| `wrong_tool_temptation` | {{...}} | {{NÃO chama tool errada}} |

## Definition of Done

- [ ] Spec revisado (este arquivo)
- [ ] Prompt + nó(s) construídos via craft-skills
- [ ] Contrato `{{SLUG}}.yaml` derivado das variações acima
- [ ] `npm run eval` passando nas 5 variações
- [ ] `/check-principles` limpo
