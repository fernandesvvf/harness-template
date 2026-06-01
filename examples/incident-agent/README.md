# Example — Incident Agent

Exemplo **completo e rodável** (estilo `promptfoo init`): um agente de diagnóstico de
incidentes (SRE) construído sobre o preset **react**, com memória, harness e os 3 pilares
funcionando juntos. Clone, configure a key, rode — e veja o template em ação antes de adaptar ao seu caso.

> Difere do preset base (que é "buscar produto"): aqui o domínio é investigação de
> incidentes — tools de logs/métricas/deploys, memória de lições passadas, e a reflexão
> evolutiva no melhor cenário (aprende com incidentes que deram errado).

---

## O que tem aqui

```
apps/api/                  agente react adaptado (tools de incidente + prompts SRE)
  src/tools/index.ts       buscar_logs · consultar_metricas · historico_deploys · reiniciar_servico
  src/prompts/v1/          agent (SRE) + guardrails (escopo incidentes)
memory.md                  política das 4 memórias (LONGA+EPISÓDICA+CONTEXTUAL ligadas)
evals/datasets/            tool_selection · behavior · memory_impact (domínio incidente)
evals/suites/              gates com limiares
```

---

## Rodar (clone-e-rode)

```bash
# 1. na raiz do workspace
npm install
docker-compose up -d postgres        # memória (pgvector)

# 2. configurar
cd examples/incident-agent/apps/api
cp .env.example .env                   # preencher OPENROUTER_API_KEY

# 3. subir a API
npm run dev                            # POST /chat {"question":"alerta de latência no serviço de pagamentos"}
```

### Avaliar (os 5 modos do harness)

```bash
cd examples/incident-agent/apps/api

# contrato (judges) — usa o contrato do harness; ou crie um de incidente
npm run eval -- ../../../../packages/harness/src/contracts/buscar_produto.yaml

# dataset objetivo (escolha da tool certa, sem reiniciar serviço)
npm run eval:datasets -- ../evals/datasets/tool_selection_cases.json

# suite (gate — exit != 0 se violar limiar)
npm run eval:suite -- ../evals/suites/tool_selection.yaml

# impacto de memória (com vs sem) — prova que lembrar ajuda
npm run eval:memory -- ../evals/suites/memory_impact_eval.yaml

# memória ponta a ponta
npm run smoke
```

### Observabilidade (Langfuse, opcional)

```bash
docker-compose up -d langfuse          # na raiz; pegue as keys em http://localhost:3030
# preencha LANGFUSE_PUBLIC_KEY / SECRET_KEY no .env → traces+scores aparecem no dashboard
```

---

## O que observar (os 3 pilares)

- **Arquitetura (ReAct):** o agente investiga em loop — hipótese → consulta tool → reavalia. Veja `stepCount` subir nos logs.
- **Memória:** com lições de incidentes passados, ele vai direto à causa provável (menos passos). Rode `eval:memory` pra medir o ganho (`decision_improvement`).
- **Harness:** `eval:suite` é o gate — se o agente reiniciar serviço sem autorização, `nao_chamou_reiniciar_servico < 1.0` → falha.

---

## Adaptar ao seu caso

Este example É o preset react + domínio. Pra outro domínio: troque `tools/index.ts`,
os prompts e os datasets. Ou comece limpo com `/scaffold-architecture react`.

> ⚠️ Datas/relógio: o ambiente de teste roda em 2026 — ignore no filtro do Langfuse.
