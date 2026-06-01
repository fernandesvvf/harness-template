# Preset Plan-Execute

Planeja tudo primeiro (1 LLM call), executa mecânico sem LLM, sintetiza no fim (1 LLM call).

```
START → guardrails → planner → executor* → synthesizer → END
                                  └──loop──┘
```

A LLM de planning faz duas coisas: **decompõe** a tarefa em steps e **parametriza** cada tool call a partir da linguagem natural ("semana passada" → `periodo: "semana_passada"`). Depois é só orquestração.

**Use quando:** fluxo previsível, steps independentes, nenhum resultado intermediário muda a sequência. Barato (2 LLM calls), paralelizável.
**Evite quando:** o resultado do step N muda o que o step N+1 deve fazer → use `react`.

---

## Estrutura

```
apps/api/src/
├── config.ts                       # PLANNER_MAX_STEPS, modelos planner/synthesizer
├── tools/registry.ts               # ADAPTE — tools executadas por nome, SEM LLM
├── prompts/v1/
│   ├── planner.prompt.ts           # ADAPTE — tools disponíveis + exemplos de plano
│   ├── synthesizer.prompt.ts       # ADAPTE — formato da resposta final
│   └── guardrails.prompt.ts
├── agent/
│   ├── graph.ts                    # planner → executor* → synthesizer
│   ├── factory.ts                  # planner + synthesizer LLMs (executor sem LLM)
│   └── nodes/
│       ├── planner.node.ts         # Fase 1: decompõe + parametriza
│       ├── executor.node.ts        # Fase 2: roda 1 step por vez, SEM LLM
│       ├── synthesizer.node.ts     # Fase 3: monta resposta final
│       └── edge-conditions.ts      # routeAfterExecutor (puro): executor | synthesizer
└── evals/run.ts
```

## O que adaptar

| Arquivo | O quê |
|---|---|
| `tools/registry.ts` | Tools executáveis por nome (I/O real). Sem LLM. |
| `prompts/v1/planner.prompt.ts` | Lista de tools + args + exemplos de plano parametrizado. |
| `prompts/v1/synthesizer.prompt.ts` | Como montar a resposta final dos resultados. |
| `config.ts` | `PLANNER_MAX_STEPS`, modelos. |

## Modo de falha (P14)

```
Plano: ["buscar usuário X", "atualizar email", "enviar confirmação"]
buscar usuário X → NOT FOUND
Plan-Execute tenta atualizar mesmo assim → erro
```
Se o resultado de um step muda o próximo, troque pra `react`. O `planner.node` tem fallback de 1 step se o planning falhar (Graceful Degradation).

## Rodar

```bash
npm install
cp apps/api/.env.example apps/api/.env
npm run dev
npm run eval
```

## Checklist
- [ ] Spec da capability escrito antes (`/craft-spec` → `specs/<cap>.spec.md`)
- [ ] `tools/registry.ts` com tools reais
- [ ] `planner.prompt.ts` lista as tools e dá exemplos de plano
- [ ] `PLANNER_MAX_STEPS` ajustado
- [ ] `.env` com `OPENROUTER_API_KEY`
- [ ] contrato de eval cobrindo as 5 variações
