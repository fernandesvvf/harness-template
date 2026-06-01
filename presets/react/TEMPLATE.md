# Preset ReAct

Agente com loop **raciocínio ↔ ação**: a cada passo o LLM decide chamar uma ferramenta ou responder. O resultado de cada ferramenta volta pro LLM raciocinar o próximo passo.

```
START → guardrails → agent ⇄ tools → END
                       └────────────→ END (sem tool_call ou teto de steps)
```

**Use quando:** caminho aberto, ramificações, debugging, pesquisa — quando o resultado de um step muda o próximo.
**Evite quando:** fluxo previsível (use `plan-execute`) ou contexto muito longo (loop alucina — o teto `REACT_MAX_STEPS` mitiga).

---

## Estrutura

```
apps/api/src/
├── config.ts                       # REACT_MAX_STEPS = teto do loop
├── tools/index.ts                  # RENOMEIE/ADAPTE — as ferramentas do agente
├── prompts/v1/
│   ├── agent.prompt.ts             # ADAPTE — papel + política de quando parar
│   └── guardrails.prompt.ts        # ADAPTE — escopo permitido
├── agent/
│   ├── graph.ts                    # estado (messages reducer) + loop ReAct
│   ├── factory.ts                  # único new XService()
│   └── nodes/
│       ├── agent.node.ts           # "Raciocinar": LLM + bindTools
│       ├── guardrails.node.ts      # fail-safe (não mudar estrutura)
│       ├── blocked.node.ts         # terminal de bloqueio
│       └── edge-conditions.ts      # routeAfterAgent (puro): tools | end
├── server.ts                       # Fastify /chat
└── evals/run.ts                    # liga o harness ao grafo
```

## O que adaptar

| Arquivo | O quê |
|---|---|
| `tools/index.ts` | Troque as tools de exemplo por I/O real (DB, API). Cada tool = ação do loop. |
| `prompts/v1/agent.prompt.ts` | Papel do agente, regras, política de finalização. |
| `prompts/v1/guardrails.prompt.ts` | Escopo permitido e regras de bloqueio do domínio. |
| `config.ts` | `REACT_MAX_STEPS`, modelos por nó. |

## O que NÃO mudar

- `services/openrouter.service.ts` — cliente LLM com fallback (o getter `.chat` é necessário pro bindTools)
- `nodes/guardrails.node.ts` + `blocked.node.ts` — padrão fail-safe
- estado `messages` com `MessagesZodMeta` — reducer de append do LangGraph

## Rodar

```bash
npm install                 # na raiz do workspace
cp apps/api/.env.example apps/api/.env   # preencha OPENROUTER_API_KEY
npm run dev                 # sobe a API
npm run eval                # roda o contrato de exemplo pelo harness
```

## Memória

Por padrão usa só **CURTA** (estado do grafo, `messages`). Para adicionar LONGA / EPISÓDICA / CONTEXTUAL: `/craft-memory <tipo>` e declare a política em `memory.md`.

## Checklist

- [ ] Spec da capability escrito antes (`/craft-spec` → `specs/<cap>.spec.md`)
- [ ] `tools/index.ts` com ferramentas reais do domínio
- [ ] `agent.prompt.ts` e `guardrails.prompt.ts` adaptados
- [ ] `REACT_MAX_STEPS` ajustado ao domínio
- [ ] `.env` criado com `OPENROUTER_API_KEY`
- [ ] contrato de eval em `packages/harness/src/contracts/` cobrindo as 5 variações
