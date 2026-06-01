# Arquiteturas Cognitivas

Skills que scaffoldam um preset de arquitetura. Princípio: P14 (Seleção de Arquitetura Cognitiva).

---

## `/scaffold-architecture <react|plan|reflection>`

**Faz:** copia `presets/<arch>/` pra um novo projeto, substitui placeholders, ajusta `config.ts` e `memory.md`.

### Como escolher

| Sintoma do problema | Arquitetura |
|---|---|
| Resultado de um step muda o próximo; caminho aberto | **react** |
| Fluxo sempre igual; steps independentes; barato | **plan** (plan-execute) |
| Erro tem custo alto; precisa revisão antes de entregar | **reflection** |

### O que cada preset garante

**react** — loop `agent ⇄ tools`, teto `REACT_MAX_STEPS`, estado `messages` com reducer.
**plan** — `planner → executor* → synthesizer`; executor sem LLM; paralelizável.
**reflection** — `generator ⇄ critic`, teto `reflectionMaxIter`; critic self ou cross (modelo maior).

### Padrão obrigatório (todos os presets)
- Teto de loop em `config.ts` — nunca loop sem limite (P14 + P8)
- `messages`/state via `withLangGraph(z.custom<BaseMessage[]>(), MessagesZodMeta)` quando há histórico
- `new StateGraph({ state })` + zod/v3 + um `OpenRouterService` por nó
- `evals/run.ts` ligando o preset ao harness via `InvokeAgent`

### Checklist
- [ ] Arquitetura escolhida pela natureza do problema, não por hábito
- [ ] Teto de loop configurado
- [ ] Guardrails + blocked presentes
- [ ] `evals/run.ts` normaliza a execução em `RunResult`
- [ ] Pelo menos 1 contrato cobrindo as 5 variações
