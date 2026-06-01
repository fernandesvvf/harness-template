# Limitações Conhecidas

Estado honesto do que foi validado em runtime e o que ainda não. Atualize ao resolver.

---

## Validado em runtime ✅

Rodado de verdade (Postgres + OpenRouter `deepseek-v4-flash` + Langfuse v2 self-host):

- **react preset** end-to-end: guardrails → recall → agent ⇄ tools → evaluate → persist
- **memória**: LONGA/EPISÓDICA/CONTEXTUAL gravando e recuperando entre execuções; embedding via OpenRouter funcionando (pgvector)
- **reflexão evolutiva**: lições extraídas e injetadas no recall
- **harness**: contrato + judges, dataset, benchmark (tokens reais via `usage_metadata`)
- **Langfuse**: traces + scores + custo no dashboard (evals)
- **Langfuse em produção**: o `/chat` dos 4 apps (3 presets + example) traça toda run automaticamente (tag `prod` + nome do preset) — validado com trace real no dashboard

---

## Bugs conhecidos 🐛

### 1. `detectSurprise` falso-positivo em domínios com "erro" no conteúdo
`persist.node` detecta "resultado inesperado" por regex `/erro|error|falha/` no texto da execução. Em domínios como **incidentes**, os logs legítimos contêm "ERROR" → toda execução vira "lição aprendida" indevidamente.
**Onde:** `persist.node.ts` (`detectSurprise`).
**Fix:** detectar surpresa por sinal estrutural (tool lançou exceção, status de erro, `evalOk=false`) em vez de substring no conteúdo.
**Severidade:** média (polui EPISÓDICA com lições espúrias; não quebra).

### 2. Síntese final vazia com modelo fraco no ReAct multi-tool
Com `deepseek-v4-flash`, o nó `agent` às vezes encerra o loop (`hasToolCalls: false`) com `content` vazio → `finalAnswer` vazio. Acontece em loops com várias tools (ex: incident-agent). Modelos mais fortes (sonnet) não têm o problema.
**Onde:** capacidade do modelo, não do código. `agent.node.ts` já trata graceful.
**Fix:** usar `AGENT_MODEL` mais forte no `.env`, ou reforçar no prompt "sempre escreva a síntese final".
**Severidade:** baixa (depende do modelo escolhido).

---

## Ainda NÃO validado em runtime ⏳

- **plan-execute** e **reflection** presets: executam no benchmark, mas o smoke de memória ponta-a-ponta não foi rodado isolado.
- **example incident-agent**: sobe e roda o loop, mas ver bug #1 e #2 acima (não fecha resposta com flash; lição espúria).
- **memory-impact eval** (`eval:memory`): código validado por typecheck; execução com/sem memória não medida de fato.
- **judges do harness** com PT/EN: os judges (`judges.ts`) podem ter o mesmo padrão de chave que corrigimos nos prompts dos presets — não testado a fundo.

---

## Notas de ambiente

- **WSL + `/mnt/c`**: funciona; I/O lento. Não misture `node_modules` instalado no Windows com execução no WSL (binários nativos brigam) — reinstale no ambiente onde vai rodar.
- **`--env-file` do Node**: não sobrescreve var já exportada no shell. Se `export $(...)` deixou vars vazias, dê `unset` antes.
- **Langfuse v2** (não v3): v3 exige clickhouse+redis+minio. v2 (web + 1 postgres) basta pro tracing. Se trocar o volume entre versões, recrie o banco (schema misto quebra).
- **Relógio do ambiente**: testes rodaram com data em 2026 — ajuste o filtro de data no dashboard Langfuse.
