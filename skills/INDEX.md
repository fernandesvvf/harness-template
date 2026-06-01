# Skills — Índice

Os comandos ficam em `skills/commands/*.md`. Copie/symlinke pra `~/.claude/commands/` pra invocar com `/nome`.

## Específicos deste template (harness + arquiteturas + memória)

| Skill | Cria/faz | Documentação |
|---|---|---|
| `/scaffold-architecture <react\|plan\|reflection>` | Scaffolda um preset novo a partir do template da arquitetura | [architectures.md](./architectures.md) |
| `/craft-contract <capability>` | Contrato YAML com as 5 variações obrigatórias | [harness.md](./harness.md) |
| `/craft-memory <curta\|longa\|episodica\|contextual>` | Adiciona um tipo de memória + entrada no `memory.md` | [memory.md](./memory.md) |

## Herdados (craft de nós/grafo)

| Skill | Documentação |
|---|---|
| `/craft-prompt` `/craft-llm-node` `/craft-io-node` | [craft.md](./craft.md) |
| `/craft-edge-conditions` `/craft-graph-state` `/craft-factory` | [craft.md](./craft.md) |
| `/check-principles` `/check-versions` | [audit.md](./audit.md) |

## Templates (presets)

| Preset | Caminho | Quando usar |
|---|---|---|
| **ReAct** | `presets/react/` | caminho aberto, ramificações, debugging |
| **Plan-Execute** | `presets/plan-execute/` | fluxo previsível, steps independentes |
| **Reflection** | `presets/reflection/` | qualidade crítica (código, jurídico) |

## Pacotes compartilhados

| Pacote | Caminho | Uso |
|---|---|---|
| `@harness/harness` | `packages/harness/` | runner + contratos + judges + Langfuse |
| `@harness/memory` | `packages/memory/` | 3 services de memória + contrato memory.md |
| `@harness/types` | `packages/types/` | tipos compartilhados |

## Como adicionar uma skill

1. Crie `skills/commands/<nome>.md` (frontmatter `description` + `argument-hint`, seções Contexto / Padrão Obrigatório / Passos / Checklist).
2. Adicione linha aqui e no `CLAUDE.md`.
3. Documente na categoria correspondente (`architectures.md`, `harness.md`, `memory.md`, `craft.md`).
