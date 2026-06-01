# Starter Skills

Skills que iniciam um projeto a partir dos presets de arquitetura cognitiva deste template.

**Presets disponíveis:**

| Preset | Quando usar |
|---|---|
| `presets/react/` | caminho aberto, ramificações, debugging — resultado de um passo muda o próximo |
| `presets/plan-execute/` | fluxo previsível, steps independentes, barato (2 LLM calls) |
| `presets/reflection/` | qualidade crítica (código, jurídico, diagnóstico) — critic loop |

Cada preset tem `TEMPLATE.md` próprio (placeholders, o que adaptar, checklist) e `memory.md` (política dos 4 tipos).

---

## `/scaffold-architecture <react|plan|reflection>`

**Quando usar:** ponto de entrada para iniciar um projeto novo a partir de um preset.

Conduz discovery curto (domínio, tools, memória), escolhe/confirma a arquitetura pela natureza do problema (P14), copia o preset e substitui placeholders.

**Processo:**
1. Escolher arquitetura pela natureza do problema (tabela acima + `skills/architectures.md`).
2. Copiar `presets/<arch>/` pro destino.
3. Substituir slug/nome (package.json, config `X_TITLE`, .env.example).
4. Adaptar tools/steps, prompts, guardrails ao domínio.
5. Ajustar tetos de loop e modelos em `config.ts`.
6. Copiar `memory.md`; deixar só CURTA enabled por padrão.
7. `npm install` na raiz; `npx tsc --noEmit` no preset.

Detalhes e padrão obrigatório: `skills/architectures.md`.

---

## Fluxo após o scaffold

```
/scaffold-architecture        ← cria o preset
   ↓
/craft-spec <capability>      ← define O QUÊ (+ 5 variações de eval)
   ↓
/craft-tasks <capability>     ← deriva as craft-skills a rodar (TodoWrite)
   ↓
/craft-prompt → /craft-*-node → /craft-edge-conditions → /craft-graph-state → /craft-factory
   ↓
/craft-memory <tipo>          ← se a capability usar memória persistida
   ↓
/craft-contract <capability>  ← deriva o eval do spec
   ↓
/check-principles
```

## Convenções não-negociáveis

- `import { z } from 'zod/v3'` — nunca `from 'zod'`
- `new StateGraph({ state: schema })` — nunca `Annotation.Root`, nunca `{ stateSchema }`
- Versões: `@langchain/langgraph 1.1.3` + `langchain 1.2.25`
- `tsconfig`: `moduleResolution: "bundler"` (necessário p/ subpaths `/prebuilt`, `/zod`)
- Um `OpenRouterService` por nó LLM; `new XService()` só no `factory.ts`
