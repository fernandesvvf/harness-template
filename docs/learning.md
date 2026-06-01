# Learning — Guia de Conceitos para Iniciantes

Este guia explica, sem assumir conhecimento prévio, **o que é cada coisa neste workspace** e **por que existe**. Cada seção: analogia simples → o que é → exemplo prático → onde mora no código.

> Leia na ordem. Cada conceito se apoia no anterior.

---

## 0. O que é um "agente de IA"?

**Analogia:** um estagiário que recebe uma tarefa em português, decide sozinho os passos, usa ferramentas (planilha, banco, busca) e entrega um resultado.

**O que é:** um programa que usa um modelo de linguagem (LLM, tipo o ChatGPT) para **decidir** o que fazer, não só responder texto. Ele pode chamar ferramentas, consultar dados e encadear vários passos.

**Exemplo:** você pergunta *"qual o preço do produto X?"*. O agente decide: "preciso buscar no catálogo" → chama a ferramenta `buscar_produto` → lê o resultado → responde. Você não programou esses passos; ele decidiu.

**Problema:** o LLM é **não-determinístico**. A mesma pergunta pode gerar respostas diferentes. Por isso precisamos de estrutura (arquitetura), de medição (harness) e de memória. São os 3 pilares deste workspace.

---

## 1. Arquiteturas cognitivas — "como o agente pensa"

Existem padrões de raciocínio. Cada um serve a um tipo de problema. Aqui temos 3 (os "presets").

### 1a. ReAct — pensar e agir em loop

**Analogia:** um detetive. Investiga uma pista, vê o que achou, decide a próxima pista. O resultado de cada passo muda o próximo.

**O que é:** o agente alterna **raciocinar → usar ferramenta → observar → raciocinar** até ter a resposta.

**Exemplo:**
```
Pergunta: "por que o app trava ao salvar PDF?"
→ pensa: pode ser memória. Ação: buscar_logs("PDF")
→ observa: "MemoryError 512MB"
→ pensa: é memória mesmo. Ação: buscar_config("max_memory")
→ observa: "256MB"
→ responde: aumentar o limite de memória
```
Cada passo dependeu do anterior. **Use quando** o caminho é aberto (debugging, pesquisa).

**Onde:** `presets/react/`

### 1b. Plan-Execute — planejar tudo, depois executar

**Analogia:** uma receita de bolo. Você lê todos os passos primeiro, depois executa um a um sem repensar.

**O que é:** o agente faz **um plano** no início (1 chamada ao LLM), executa os passos mecanicamente (sem LLM no meio), e no fim resume.

**Exemplo:**
```
Pergunta: "relatório de vendas da semana por região"
→ plano: [buscar vendas, buscar regiões, gerar PDF]
→ executa os 3 (sem pensar entre eles)
→ resume: "relatório pronto"
```
**Use quando** o fluxo é sempre igual e previsível. É mais barato (menos chamadas ao LLM).

**Onde:** `presets/plan-execute/`

### 1c. Reflection — gerar e criticar

**Analogia:** escrever um texto e pedir pra um revisor checar antes de entregar. Se tiver erro, corrige e revisa de novo.

**O que é:** um LLM gera a resposta, **outro LLM critica**. Se reprovar, o gerador melhora. Repete até aprovar (ou bater um limite).

**Exemplo:**
```
gera código → crítico: "tem SQL injection!" → gera de novo corrigido
→ crítico: "aprovado"
```
**Use quando** errar é caro (código, contrato jurídico, diagnóstico médico).

**Onde:** `presets/reflection/`

### Como escolher?

| Problema | Arquitetura |
|---|---|
| caminho aberto, cada passo muda o próximo | ReAct |
| fluxo previsível, passos fixos | Plan-Execute |
| qualidade crítica, erro caro | Reflection |

### O ciclo de referência (recuperar → perceber → planejar → agir → avaliar → persistir)

Existe um **ciclo ideal** de um agente com memória:

```
recuperar contexto → perceber → planejar → agir → avaliar → persistir memória
  "o que já sei"                                              "o que aprendi"
```

Os **3 presets cobrem o ciclo completo**. Cada um implementa as 6 fases; o que muda é *como* (e quanta memória usa). O mapa:

| Fase do ciclo | ReAct | Plan-Execute | Reflection |
|---|---|---|---|
| recuperar contexto | `recall` ✅ | `recall` ✅ | `recall` ✅ |
| perceber | `agent` | `executor` | `generator` |
| planejar | `agent` | `planner` ✅ | `generator` |
| agir | `agent` ⇄ `tools` ✅ | `executor` ✅ | `generator` |
| **avaliar** | `evaluate` ✅ | `evaluate` ✅ | `critic` ✅ |
| persistir memória | `persist` ✅ | `persist` ✅ | `persist` ✅ |

Leitura:
- **ReAct** funde perceber+planejar+agir no `agent` (natureza do ReAct); `evaluate` é auto-avaliação fail-open.
- **Plan-Execute** destaca **planejar** (`planner`); memória **enxuta** (só LONGA + EPISÓDICA, busca por filtro — não usa CONTEXTUAL/semântica, que não casa com fluxo previsível).
- **Reflection** personifica **avaliar** no `critic` (não precisa de `evaluate` separado); memória **completa** + reflexão evolutiva (critic reprova → vira lição).

Decisão de arquitetura importante: **avaliar fail-open** (`evaluate`) nunca bloqueia — registra a qualidade e, se baixa, sinaliza pro `persist` aprender a lição. Memória é **opt-in** via `memory.md`: react já vem com tudo ligado; plan-execute e reflection vêm só com CURTA (ligue o resto conforme precisar).

---

## 2. O grafo, os nós e o estado (LangGraph)

**Analogia:** um fluxograma. Cada caixa é uma etapa; as setas dizem o que vem depois.

- **Nó (node):** uma etapa do processo. Ex: "validar pergunta", "buscar produto", "responder".
- **Aresta (edge):** a seta — qual nó vem depois. Algumas são condicionais ("se bloqueado → fim").
- **Estado (state):** uma ficha que passa por todos os nós, acumulando informação (a pergunta, o histórico, a resposta).

**Exemplo (react):**
```
[guardrails] → [recall] → [agent] ⇄ [tools] → [persist] → fim
```
A "ficha" (estado) entra vazia, cada nó preenche um pedaço, sai completa no fim.

**Regra de ouro:** nó nunca **muda** a ficha direto — devolve só o pedaço que mudou, e o framework junta. Isso evita bugs difíceis.

**Onde:** `presets/*/apps/api/src/agent/graph.ts` (monta o fluxograma) e `nodes/` (cada etapa).

---

## 3. Harness — "como sei que está certo?"

**Analogia:** o banco de provas de uma fábrica de carros. O carro (agente) é testado num ambiente controlado, com critérios objetivos, antes de ir pra rua.

**O problema:** como o agente é não-determinístico, teste comum (passou/falhou) não basta. Precisamos de **notas** (0 a 1) e **vários casos**.

**O que é:** a infraestrutura que **roda o agente em casos de teste e dá nota**. Tem três jeitos de medir:

### 3a. Contratos (YAML) + juiz LLM
Um arquivo descreve uma capacidade e seus casos. Um "juiz" (outro LLM) dá nota à qualidade.

**Exemplo** (`buscar_produto.yaml`):
```yaml
- id: happy_path
  input: "qual o preço do produto X?"
  assertions:
    tool_calls: [{ tool: buscar_produto, required: true }]
    output: { contains: ["preço"] }
```

### 3b. Datasets (JSON) + nota objetiva
Casos com **gabarito**. A nota é calculada por comparação, sem LLM. Mais preciso.

**Exemplo** (`tool_selection_cases.json`): "para esta pergunta, a ferramenta certa é X e a errada é Y" → mede se acertou.

### 3c. As 5 variações de todo caso bem-feito
Para cobrir o comportamento, cada capacidade tem:

| Variação | O que testa |
|---|---|
| happy_path | o caminho ideal |
| edge_case | um limite (ex: produto inexistente) |
| adversarial | tentativa de quebrar (ex: hack na entrada) |
| ambiguous | pergunta vaga (deve pedir clarificação) |
| wrong_tool_temptation | pega-ratoeira (não usar a ferramenta errada) |

**Observabilidade (Langfuse):** além das notas, registra custo, tempo e o "raciocínio" de cada passo — pra você ver *por que* o agente fez o que fez.

### 3d. Benchmark — comparar arquiteturas com dados
Roda o **mesmo dataset nos 3 presets** e compara tokens (custo), tempo, conclusão e cobertura. É assim que você decide qual arquitetura usar **com números, não achismo** (fecha o conceito do item 1). Ex: Plan-Execute costuma gastar menos tokens que ReAct no mesmo problema. Gera `benchmarks/report.md` com veredito. Comando: `npm run benchmark`.

**Onde:** `packages/harness/` — `contracts/`, `evals/datasets/`, `runner.ts`, `scorers.ts`, `benchmark-runner.ts`, `token-meter.ts`.

---

## 4. Memória — "o que o agente lembra"

**Analogia:** a memória humana tem tipos diferentes. O que você está pensando agora (curta), fatos que você sabe (longa), o que aconteceu ontem (episódica), e procurar algo parecido na sua cabeça (associação).

São **4 tipos**, cada um com uma função:

| Tipo | Analogia | Exemplo | Vida |
|---|---|---|---|
| **CURTA** | mesa de trabalho | o histórico desta conversa | morre no fim da execução |
| **LONGA** | caderno | "este cliente sempre compra 10 unidades" | pra sempre |
| **EPISÓDICA** | diário | "ontem resolvi um caso parecido assim" | tempo configurável |
| **CONTEXTUAL** | busca interna | "trechos parecidos com esta pergunta" | sob demanda |

### Dois jeitos de buscar memória
- **Por filtro** (exato): "me dá tudo do cliente 123" — LONGA, EPISÓDICA.
- **Por significado** (semântica): "me dá o que for *parecido* com esta pergunta" — CONTEXTUAL, usando embeddings (uma forma de medir similaridade entre textos).

### Por que medir a memória? Os 3 cenários
Memória mal configurada **atrapalha**:
- **BOA:** lembrou algo útil → resolveu mais rápido. ✅
- **IRRELEVANTE:** trouxe lixo → poluiu o contexto, gastou tokens à toa.
- **PERIGOSA:** lembrou um fato **desatualizado** → respondeu errado.

Por isso a política de cada tipo (o que guardar, por quanto tempo, com que filtro) fica num contrato: o `memory.md`.

**Onde:** `packages/memory/` (os serviços) + `memory.md` (a política).

---

## 5. Reflexão evolutiva — "aprender com os próprios erros"

**Analogia:** depois de errar, você anota a lição: "da próxima, confiro o estoque antes de prometer entrega". E percebe padrões: "toda vez que pulo essa checagem, dá problema".

**O que é:** dois níveis.
- **Nível 1 (por execução):** se algo deu **inesperado** (erro, travou), o agente extrai uma **lição generalizável** — não "o produto Z esgotou", mas "verifique estoque antes de finalizar". Guarda na memória episódica.
- **Nível 2 (a cada N execuções):** um processo varre as lições, acha **padrões repetidos** e os promove a fato durável (memória longa).

**Por que "generalizável"?** Lição específica demais ("produto Z esgotou em 12/05") não serve pra mais nada. Generalizada ("cheque estoque antes de prometer") vale pra qualquer caso futuro.

**Onde:** `presets/react/` — nó `persist` (nível 1) + `scripts/consolidate-lessons.ts` (nível 2).

---

## 6. Spec-Driven — "definir antes de construir"

**Analogia:** a planta da casa antes de levantar paredes. Você decide o que cada cômodo faz; só depois constrói.

**O que é:** antes de programar, você escreve uma **spec** — um documento que diz **o que** a capacidade deve fazer (entrada, saída, regras, ferramentas, memória, como pode falhar). Daí o código tem um alvo claro, e os testes (harness) saem quase de graça da spec.

**Exemplo:** ver `presets/react/specs/buscar-produto.spec.md` — descreve o comportamento, e o contrato de teste `buscar_produto.yaml` veio dele.

**Onde:** `spec.template.md` (modelo) + `specs/` em cada preset.

---

## 7. Os princípios de software (PATTERNS.md)

O código segue regras que tornam tudo testável e fácil de mudar. Em linguagem simples:

| Princípio | Em uma frase |
|---|---|
| Separation of Concerns | cada arquivo faz **uma** coisa |
| Dependency Injection | o nó **recebe** o que precisa, não cria sozinho (facilita testar) |
| Factory | um único lugar cria tudo (`factory.ts`) |
| Schema-First | define o **formato** dos dados antes da lógica (Zod valida) |
| Pure Functions | funções de decisão sem efeitos colaterais (testáveis sozinhas) |
| Graceful Degradation | se algo falha, degrada com elegância, não quebra tudo |
| Configuration as Code | nada de número mágico no meio do código; vai pra `config.ts` |

Detalhes e exemplos certo/errado: [PATTERNS.md](../PATTERNS.md).

---

## 8. Como tudo se conecta

```
escolho a arquitetura (ReAct/Plan/Reflection)   ← pilar 1
   ↓
escrevo a spec (o quê)                           ← spec-driven
   ↓
construo os nós do grafo                          ← LangGraph
   ↓  (o agente usa memória pra lembrar)          ← pilar 3
mede com o harness (notas)                        ← pilar 2
   ↓
aprende com os erros (reflexão evolutiva)
```

Os 3 pilares + spec-driven se reforçam: a arquitetura decide como pensa, a spec registra o esperado, a memória dá contexto, e o harness prova que está funcionando — com **números**, não achismo.

> "Só medindo pra saber em qual cenário você está. Intuição não basta." — princípio central do workspace.

---

## Glossário rápido

- **LLM:** modelo de linguagem (o "cérebro" de texto, ex: Claude/GPT).
- **Tool (ferramenta):** uma ação que o agente pode chamar (buscar no banco, calcular...).
- **Embedding:** representação numérica de um texto, usada pra achar textos parecidos.
- **Token:** pedaço de texto que o LLM processa; mais tokens = mais custo.
- **Schema (Zod):** o "molde" que valida o formato dos dados.
- **Scope (scopeId):** a quem/o-quê a memória pertence (um usuário, um job, global).
- **Eval:** avaliação automatizada do agente (rodar casos e dar nota).
- **Preset:** um template pronto de arquitetura (react/plan/reflection).
