# Preset Reflection

Um gerador produz a resposta; um **critic** a avalia antes de entregar. Loop até aprovar ou atingir o teto.

```
START → guardrails → generator → critic → END (aprovado ou teto)
                         ↑──────────┘ (não aprovado → melhora)
```

> Reflection não é arquitetura alternativa — é uma **camada** em cima de um gerador.
> Aqui o gerador é um nó LLM simples. Para casos reais, troque por um subgraph react/plan.

**Use quando:** o erro tem custo alto (código, jurídico, diagnóstico) e há critério objetivo de avaliação.
**Evite quando:** critério de parada mal definido (loop infinito) ou critic fraco (só adiciona latência).

---

## Estrutura

```
apps/api/src/
├── config.ts                       # GENERATOR_MODEL, CRITIC_MODEL, REFLECTION_MAX_ITER
├── prompts/v1/
│   ├── generator.prompt.ts         # ADAPTE — papel do gerador
│   ├── critic.prompt.ts            # ADAPTE — critérios de avaliação (seja específico!)
│   └── guardrails.prompt.ts
├── agent/
│   ├── graph.ts                    # generator ⇄ critic
│   ├── factory.ts                  # generator + critic LLMs
│   └── nodes/
│       ├── generator.node.ts       # gera/melhora com base na crítica
│       ├── critic.node.ts          # approved:boolean + feedback
│       └── edge-conditions.ts      # routeAfterCritic (puro): generator | end
└── evals/run.ts
```

## Self vs Cross reflection

| Variação | CRITIC_MODEL | Custo |
|---|---|---|
| **Self** | = GENERATOR_MODEL | baixo |
| **Cross** | modelo maior (ex: opus critica sonnet) | alto, melhor |

Só trocar a env `CRITIC_MODEL`.

## Modo de falha (P14)

- **Critério de parada mal definido** → o `critic` retorna `approved: boolean` explícito + teto `REFLECTION_MAX_ITER`. Nunca loop sem limite.
- **Critic fraco** → critérios genéricos não melhoram nada. Seja específico em `critic.prompt.ts` (ex: "trata input None?", "tem SQL injection?").

## Trocar o gerador por um subgraph

`generator.node.ts` chama 1 LLM. Para reflection sobre react/plan: importe o `buildAgentGraph` do outro preset, invoque dentro do `generatorNode`, e ponha o resultado em `draft`.

## Rodar

```bash
npm install
cp apps/api/.env.example apps/api/.env
npm run dev
npm run eval
```

## Checklist
- [ ] `critic.prompt.ts` com critérios ESPECÍFICOS do domínio
- [ ] `REFLECTION_MAX_ITER` definido (sem loop infinito)
- [ ] self ou cross escolhido via `CRITIC_MODEL`
- [ ] `.env` com `OPENROUTER_API_KEY`
- [ ] contrato de eval cobrindo as 5 variações
