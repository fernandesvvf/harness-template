# Padrões de Software — Referência

Princípios arquiteturais aplicados em todos os projetos deste workspace.
Cada padrão é explicado com: conceito, problema que resolve, como aparece no código, e quando usar.

---

## 1. Separation of Concerns (SoC)

### O que é
Cada módulo do sistema tem **uma única responsabilidade**. Quando algo muda, você sabe exatamente onde tocar.

### Problema que resolve
Sem SoC, uma mudança em um requisito obriga você a alterar vários arquivos ao mesmo tempo. Isso aumenta o risco de bugs e dificulta testes.

### Como aparece no projeto

```
services/openrouter.service.ts  → só fala com o LLM
services/neo4j.service.ts       → só acessa o Neo4j
prompts/v1/cypher.prompt.ts     → só define schema e prompts do nó cypher
agent/nodes/cypher.node.ts      → só orquestra: chama serviços, monta retorno
agent/nodes/edge-conditions.ts  → só decide o próximo nó
```

Se a API do OpenRouter mudar → toca só `openrouter.service.ts`.
Se o banco mudar → toca só o service correspondente.
Se o prompt mudar → toca só `prompts/v1/`.

### Quando usar
Sempre. É o princípio mais fundamental de design de software.

---

## 2. Dependency Injection (DI)

### O que é
Um módulo **não cria suas próprias dependências** — ele as recebe de fora. Quem cria é um ponto central (o `factory.ts`).

### Problema que resolve
Sem DI, se você quer testar um nó, precisa subir o banco real, conectar ao LLM real, etc. Com DI, você injeta mocks e testa isoladamente.

### Como aparece no projeto

```typescript
// SEM DI — nó cria suas próprias dependências (acoplado)
export function makeCypherNode() {
  const llm = new OpenRouterService(config.models.cypher) // ❌
  return async (state) => { ... }
}

// COM DI — nó recebe dependências prontas
export function makeCypherNode(llm: OpenRouterService, maxHops: number) {
  return async (state) => { ... }
}

// factory.ts é o único que instancia tudo
const cypherLlm = new OpenRouterService(config.models.cypher)
const cypherNode = makeCypherNode(cypherLlm, config.agent.cypherMaxHops)
```

### Quando usar
Sempre que um módulo precisar de um serviço externo (banco, API, LLM). Regra: se você não consegue testar o módulo sem subir infraestrutura, ele tem dependências diretas que precisam ser injetadas.

---

## 3. Factory Pattern

### O que é
Uma função específica é responsável por **criar e montar** objetos complexos, escondendo a complexidade de construção do restante do sistema.

### Problema que resolve
Sem factory, cada arquivo que precisa do grafo teria que saber como montar todas as peças. Com factory, você chama `buildAgent()` e recebe tudo pronto.

### Como aparece no projeto

```typescript
// factory.ts — único ponto de montagem
export function buildAgent() {
  // 1. Cria dependências de infraestrutura
  const guardrailsLlm = new OpenRouterService(config.models.guardrails)
  const cypherLlm     = new OpenRouterService(config.models.cypher)
  const neo4j         = new Neo4jService()

  // 2. Passa para o grafo via AgentDeps
  return buildAgentGraph({ guardrailsLlm, cypherLlm, neo4j })
}

// server.ts — não sabe como o agente é montado, só usa
const agent = buildAgent()
```

### Relação com DI
Factory Pattern e DI andam juntos: o Factory é onde você aplica a DI. O Factory cria, o DI distribui.

### Quando usar
Quando a criação de um objeto envolve múltiplos passos, configurações ou dependências.

---

## 4. Strategy Pattern

### O que é
Define uma família de comportamentos intercambiáveis. O comportamento muda conforme o "strategy" passado — sem duplicar código.

### Problema que resolve
Sem Strategy, você teria múltiplos métodos (`generateForCypher`, `generateForSynthesizer`) ou condicionais dentro do método. Com Strategy, um único método serve para todos os nós.

### Como aparece no projeto

```typescript
// OpenRouterService — um único método, comportamento muda pelo schema
async generateStructured<T>(
  systemPrompt: string,
  userPrompt: string,
  schema: z.ZodSchema<T>,  // ← este é o "strategy"
): Promise<{ success: true; data: T } | { success: false; error: string }>

// Uso no cypherNode — strategy = CypherOutputSchema
const result = await llm.generateStructured(
  getCypherSystemPrompt(maxHops), getCypherUserPrompt(subQuestion), CypherOutputSchema
)

// Uso no synthesizerNode — strategy = SynthesizerOutputSchema
const result = await llm.generateStructured(
  getSynthesizerSystemPrompt(), getSynthesizerUserPrompt(question, data), SynthesizerOutputSchema
)
```

O método é o mesmo. O schema Zod é o strategy que define o formato do output.

### Quando usar
Quando você tem a mesma operação que precisa se comportar de formas diferentes dependendo do contexto.

---

## 5. Schema-First Design (Contract-First)

### O que é
Você define o **contrato de dados** (o schema) antes de escrever a lógica. O schema é a fonte da verdade sobre o formato dos dados.

### Problema que resolve
LLMs são não-determinísticos — podem retornar JSON malformado, campos faltando, tipos errados. Sem validação, o sistema quebra de formas imprevisíveis. Com Schema-First, outputs inválidos são rejeitados antes de chegar na lógica de negócio.

### Como aparece no projeto

```typescript
// 1. PRIMEIRO — define o contrato (em prompts/v1/)
export const CypherOutputSchema = z.object({
  query: z.string().min(1),
})

// 2. DEPOIS — escreve a lógica que depende do contrato
const result = await llm.generateStructured(..., CypherOutputSchema)

// 3. TypeScript conhece o tipo exato — sem casting manual
if (result.success) {
  return { cypherQuery: result.data.query } // string garantida pelo schema
}
```

### Por que JSON nos prompts
O system prompt formatado como `JSON.stringify({...})` reduz ambiguidade e permite diff entre versões como qualquer código:

```typescript
export function getCypherSystemPrompt(maxHops: number): string {
  return JSON.stringify({
    role: 'Especialista em Cypher...',
    regras: [`Máximo ${maxHops} hops por query`, ...],
    exemplos: [...],
    instrucao_de_formato: JSON_FORMAT_INSTRUCTION,
  })
}
```

### Quando usar
Sempre que interagir com LLMs, APIs externas, ou qualquer fonte de dados não confiável.

---

## 6. Pure Functions

### O que é
Uma função pura retorna sempre o mesmo resultado para os mesmos inputs e não tem efeitos colaterais (sem I/O, sem estado global, sem mutações).

### Problema que resolve
Funções com side effects são difíceis de testar e raciocinar. Uma função pura de roteamento pode ser testada unitariamente sem subir nenhuma infraestrutura.

### Como aparece no projeto

```typescript
// edge-conditions.ts — funções 100% puras
export function routeAfterGuardrails(state: AgentState): 'planner' | 'blocked' {
  return state.isBlocked ? 'blocked' : 'planner'
}

// Testável sem mocks, sem banco, sem LLM:
expect(routeAfterGuardrails({ isBlocked: true })).toBe('blocked')

// Quando usa parâmetro de config → aplicação parcial (continua pura)
export function makeRouteAfterExecution(maxRetries: number) {
  return function routeAfterExecution(state: AgentState): 'corrector' | 'cypher' | 'synthesizer' {
    if (state.queryError && (state.correctionAttempts ?? 0) < maxRetries) return 'corrector'
    if (!state.queryError && (state.currentStep ?? 0) < (state.queryPlan ?? []).length) return 'cypher'
    return 'synthesizer'
  }
}
```

A separação é intencional: lógica de roteamento é pura, lógica com I/O fica nos nós.

### Quando usar
Toda vez que você precisa de lógica de decisão ou transformação de dados sem I/O. Se a função não precisa de efeitos colaterais, faça ela pura.

---

## 7. Imutabilidade de Estado

### O que é
O estado nunca é modificado diretamente — cada nó retorna um parcial com as mudanças. O framework (LangGraph) é responsável pelo merge.

### Problema que resolve
Mutação direta do estado cria bugs difíceis de rastrear, especialmente em sistemas com múltiplos nós lendo e escrevendo o mesmo estado.

### Como aparece no projeto

```typescript
// ERRADO — mutação direta
state.subResults.push(stepResult)   // ❌
state.currentStep++                  // ❌

// CORRETO — retorna parcial, LangGraph faz o merge
return {
  subResults: [...(state.subResults ?? []), stepResult],
  currentStep: (state.currentStep ?? 0) + 1,
  queryError: undefined,
}

// Para dados externos: structuredClone garante sem referências compartilhadas
const stepResult = structuredClone(rawResult) // ✅
```

### Quando usar
Em qualquer sistema com estado compartilhado ou reativo (LangGraph, Redux, Flux).

---

## 8. Configuration as Code

### O que é
Toda configuração que pode mudar entre ambientes fica centralizada e externalizada — nunca hardcoded na lógica de negócio.

### Problema que resolve
Magic numbers espalhados pelo código são difíceis de encontrar e alterar com segurança.

### Como aparece no projeto

```typescript
// config.ts — única fonte da verdade, validada por Zod
const EnvSchema = z.object({
  CYPHER_MAX_HOPS: z.coerce.number().default(3),
  PLANNER_MAX_STEPS: z.coerce.number().default(4),
  GUARDRAILS_MODEL: z.string().default('anthropic/claude-haiku-4-5-20251001'),
})

export const config = {
  agent: { cypherMaxHops: parsed.data.CYPHER_MAX_HOPS },
  models: { guardrails: parsed.data.GUARDRAILS_MODEL },
} as const

// Nó usa config via parâmetro — não lê config.ts diretamente
export function makeCypherNode(llm: OpenRouterService, maxHops: number) { ... }
// graph.ts passa o valor:
.addNode('cypher', makeCypherNode(cypherLlm, config.agent.cypherMaxHops))
```

### As três camadas de configuração

| Camada | Onde fica | Para quê |
|---|---|---|
| Segredos | `.env` (nunca no git) | API keys, connection strings |
| Parâmetros | `config.ts` | Thresholds, modelos, limites |
| Comportamento | `prompts/v1/` | System prompts, schemas, exemplos |

### Quando usar
Sempre. Se um desenvolvedor precisaria perguntar "posso mudar esse valor?", ele deveria estar em `config.ts`.

---

## 9. Graceful Degradation

### O que é
Quando uma parte do sistema falha, o sistema continua funcionando de forma degradada ao invés de quebrar completamente.

### Problema que resolve
LLMs falham, bancos ficam indisponíveis, APIs têm timeouts. Sem tratamento, uma falha em um nó derruba todo o pipeline.

### Como aparece no projeto

```typescript
// Todo nó com I/O tem try/catch + verificação de result.success
export function makeGuardrailsNode(llm: OpenRouterService) {
  return async function guardrailsNode(state: AgentState): Promise<Partial<AgentState>> {
    try {
      const result = await llm.generateStructured(...)

      if (!result.success) {
        logger.warn({ error: result.error }, 'guardrails LLM falhou — bloqueando por padrão')
        return { isBlocked: true, blockReason: 'Não foi possível validar a pergunta.' }
      }

      return { isBlocked: !result.data.safe, blockReason: result.data.reason }
    } catch (err) {
      logger.error({ err }, 'guardrails lançou exceção — bloqueando por padrão')
      return { isBlocked: true, blockReason: 'Não foi possível validar a pergunta.' }
    }
  }
}
```

### Níveis de degradação

```
guardrails falha   → bloqueia por padrão (fail-safe crítico)
planner falha      → usa pergunta original como plano de 1 step (degradável)
cypher falha       → seta queryError → corrector tenta corrigir (degradável)
corrector falha    → mantém queryError → synthesizer recebe o contexto (degradável)
synthesizer falha  → retorna mensagem de erro amigável (degradável)
```

### Quando usar
Toda vez que chamar serviço externo. Classifique: críticos (bloqueiam tudo) vs. degradáveis (continuam com comportamento reduzido).

---

## 10. Prompt Versioning

### O que é
Prompts são tratados como código — versionados, rastreáveis, com rollback possível.

### Problema que resolve
Um prompt mudado pode alterar completamente o comportamento do sistema. Sem versioning, não há como reverter ou comparar.

### Como aparece no projeto

```
prompts/
  v1/
    cypher.prompt.ts     ← versão em produção
    synthesizer.prompt.ts
  v2/                    ← nova versão em desenvolvimento
    cypher.prompt.ts
```

```typescript
// cypher.node.ts — importa versão específica
import { getCypherSystemPrompt } from '../../prompts/v1/cypher.prompt.js'

// Para testar v2: só muda o import
import { getCypherSystemPrompt } from '../../prompts/v2/cypher.prompt.js'
```

Cabeçalho obrigatório em todo arquivo de prompt:
```typescript
// prompt: cypher v1 — 2026-04-24
// comportamento: gera query Cypher para o grafo a partir de sub-pergunta em linguagem natural
// schema: { query: string }
// criar v2 se: mudar o schema do grafo, adicionar parâmetros nomeados, ou mudar regras de sintaxe
```

### Quando usar
Sempre que o sistema usar LLMs em produção. Regra de ouro: nunca edite um prompt em produção — crie uma v2, teste, depois troque.

---

## 11. O Papel dos Nós (Nodes)

### O que é
Nós são a camada de **orquestração da regra de negócio** — não a implementação técnica, nem a decisão de roteamento.

### Problema que resolve
Sem essa distinção, a lógica de negócio fica misturada com I/O (serviços) ou com decisões de fluxo (edge conditions), tornando o sistema difícil de testar e manter.

### O que pertence ao nó

```typescript
// cypher.node.ts — orquestra, não implementa
export function makeCypherNode(llm: OpenRouterService, maxHops: number) {
  return async (state: AgentState): Promise<Partial<AgentState>> => {
    const subQuestion = (state.queryPlan ?? [])[state.currentStep ?? 0] ?? ''

    // 1. Delega ao service (gera Cypher)
    const result = await llm.generateStructured(
      getCypherSystemPrompt(maxHops),
      getCypherUserPrompt(subQuestion, state.queryError),
      CypherOutputSchema,
    )

    // 2. Trata falha (Graceful Degradation)
    if (!result.success) return { queryError: `Falha: ${result.error}` }

    // 3. Retorna estado parcial (Imutabilidade)
    return { cypherQuery: result.data.query, queryError: undefined }
  }
}
```

### O que NÃO pertence ao nó

| Responsabilidade | Onde fica |
|---|---|
| Comunicação com LLM / API | `services/` |
| Acesso ao banco | `services/` |
| Decisão de qual nó vem depois | `nodes/edge-conditions.ts` |
| Schema Zod / formato do prompt | `prompts/v1/` |
| Thresholds e configurações | `config.ts` |
| Instanciação de dependências | `factory.ts` |

### Quando usar
Todo passo do processo de negócio vira um nó. Regra: se você consegue descrever o que o nó faz em uma frase ("valida a pergunta", "gera Cypher", "sintetiza resposta"), ele está bem definido.

---

## 12. Guia de Modificação — Como Adicionar Lógica de Negócio

### A ordem importa: de dentro para fora

```
1. prompts/v1/   ← define o schema (contrato)
2. services/     ← implementa o acesso a dados / LLM
3. nodes/        ← orquestra a lógica usando os services
4. graph.ts      ← conecta o nó ao grafo
5. factory.ts    ← injeta as dependências no novo nó
```

### Cenário A — Adicionar nó com chamada ao LLM

**Passo 1 — `prompts/v1/intentClassification.ts`**
```typescript
export const IntentSchema = z.object({
  intent: z.enum(['question', 'complaint', 'smalltalk']),
  confidence: z.number().min(0).max(1),
})
export const getIntentSystemPrompt = () => JSON.stringify({ role: '...', exemplos: [...] })
export const getIntentUserPrompt = (message: string) => JSON.stringify({ mensagem: message })
```

**Passo 2 — `nodes/classifyIntent.node.ts`**
```typescript
export function makeClassifyIntentNode(llm: OpenRouterService) {
  return async (state: AgentState): Promise<Partial<AgentState>> => {
    try {
      const result = await llm.generateStructured(
        getIntentSystemPrompt(), getIntentUserPrompt(state.question ?? ''), IntentSchema
      )
      if (!result.success) return { intent: undefined }
      return { intent: result.data.intent }
    } catch (err) {
      return { intent: undefined }
    }
  }
}
```

**Passo 3 — `graph.ts`**
```typescript
const AgentStateAnnotation = z.object({
  // ...campos existentes...
  intent: z.string().optional(), // ← novo campo
})

new StateGraph({ state: AgentStateAnnotation })
  .addNode('classifyIntent', makeClassifyIntentNode(intentLlm))
  .addEdge(START, 'classifyIntent')
  .addEdge('classifyIntent', 'guardrails')
```

**Passo 4 — `factory.ts`** (só se precisar de novo service)
```typescript
const intentLlm = new OpenRouterService(config.models.intent)
return buildAgentGraph({ ..., intentLlm })
```

### Cenário B — Adicionar nó de I/O puro

**Passo 1 — `services/analytics.service.ts`**
```typescript
export class AnalyticsService {
  async logEvent(event: string, metadata: object): Promise<void> { ... }
}
```

**Passo 2 — `nodes/logAnalytics.node.ts`**
```typescript
export function makeLogAnalyticsNode(analytics: AnalyticsService) {
  return async (state: AgentState): Promise<Partial<AgentState>> => {
    try {
      await analytics.logEvent('query_answered', { question: state.question })
    } catch (err) {
      logger.warn({ err }, 'analytics falhou — continuando')
    }
    return {} // não altera o estado
  }
}
```

**Passo 3 — `factory.ts`** — instancia o novo service e injeta
```typescript
const analytics = new AnalyticsService(config.analytics.apiKey)
return buildAgentGraph({ ..., analytics })
```

### Checklist antes de considerar a mudança pronta

- [ ] Schema Zod definido antes de escrever a lógica do nó
- [ ] Nó recebe dependências por parâmetro (não instancia nada)
- [ ] Nó retorna `Partial<State>`, nunca muta diretamente
- [ ] `try/catch` em todo `await` externo
- [ ] `edge-conditions.ts` atualizado se nova rota for necessária
- [ ] `graph.ts` com o nó registrado e edges conectadas
- [ ] `factory.ts` atualizado se o nó tem nova dependência de infra
- [ ] Prompt com comportamento novo → nova versão em `prompts/v2/`

---

## Visão Consolidada — Onde Cada Padrão Aparece

```
config.ts
  └─ Configuration as Code

factory.ts
  └─ Factory Pattern
  └─ Dependency Injection (único ponto de instanciação)

graph.ts
  └─ Imutabilidade de Estado (z.object state + retorno Partial)

nodes/<nome>.node.ts
  └─ Dependency Injection (recebe deps via parâmetro)
  └─ Graceful Degradation (try/catch + if !result.success)
  └─ Schema-First (usa schema de prompts/v1/)
  └─ Papel dos Nós (orquestra, não implementa)

nodes/edge-conditions.ts
  └─ Pure Functions (sem I/O, sem side effects)
  └─ Separation of Concerns (só roteamento)

services/<nome>.service.ts
  └─ Strategy Pattern (generateStructured<T> com schema como parâmetro)
  └─ Separation of Concerns (só infraestrutura)

prompts/v1/<nome>.prompt.ts
  └─ Prompt Versioning (cabeçalho + pasta v1/)
  └─ Schema-First Design (Zod antes de qualquer função)
```

---

## 13. Persistência em Duas Camadas (Short-term + Long-term)

### O que é
Agentes conversacionais usam dois mecanismos de persistência com propósitos distintos:
- **Short-term (por sessão):** histórico de mensagens da conversa atual
- **Long-term (cross-session):** dados que devem sobreviver entre sessões separadas

### Problema que resolve
Sem separação, ou você guarda tudo (caro, lento) ou perde contexto entre sessões (experiência ruim). Com duas camadas, o histórico pode ser comprimido sem perder o que importa sobre o usuário.

### Como aparece no projeto

```
PostgreSQL (via LangGraph Checkpointer)   ← short-term
  └─ Histórico completo por thread_id
  └─ Gerenciado automaticamente pelo LangGraph
  └─ Permite retomar conversa exatamente onde parou

SQLite / banco leve (via service próprio)  ← long-term
  └─ Preferências e contexto do usuário
  └─ Persiste entre sessões do mesmo usuário
  └─ Merge inteligente: acumula, não sobrescreve
  └─ Injetado no system prompt de cada nova conversa
```

### Por que dois bancos diferentes
PostgreSQL é robusto para histórico transacional com isolamento por thread.
SQLite é leve e sem servidor — ideal para dados de usuário que não precisam de ACID completo.
Em produção AWS, o equivalente é DynamoDB (short) + RDS (long).

### Quando usar
Sempre que o agente precisar reconhecer o usuário em sessões futuras ou personalizar respostas com base em histórico acumulado.

---

## 14. Seleção de Arquitetura Cognitiva

### O que é
O **formato do grafo segue a arquitetura cognitiva escolhida** — ReAct, Plan-Execute ou Reflection — não é montado ad-hoc. Cada uma tem fluxo, custo e modo de falha próprios.

### Problema que resolve
Sem escolher conscientemente, você usa ReAct (caro, N calls de LLM) onde Plan-Execute (2 calls) bastava, ou Plan-Execute onde o problema exige replanejar a cada step. A arquitetura errada custa tokens ou faz o agente travar.

### Como aparece no projeto

```
presets/react/         → loop agent ⇄ tools ; teto REACT_MAX_STEPS
presets/plan-execute/  → planner → executor* → synthesizer
presets/reflection/    → generator ⇄ critic ; teto reflectionMaxIter
```

### Tabela de decisão

| | ReAct | Plan-Execute | Reflection |
|---|---|---|---|
| LLM calls | N (por step) | 2 (plan + synth) | 2×N (gen + critic) |
| Flexibilidade | alta | baixa | depende da base |
| Custo / Latência | médio | baixo | alto |
| Melhor para | exploração, ramificações | fluxo previsível | qualidade crítica |
| Falha quando | contexto longo → alucina | step N afeta step N+1 | critic fraco → só latência |

### Como evitar a falha
Todo loop tem **teto explícito** em `config.ts` (`REACT_MAX_STEPS`, `reflectionMaxIter`) — Configuration as Code (P8). Sem teto, ReAct alucina e Reflection entra em loop infinito.

### Relação com o ciclo de referência
O ciclo de um agente com memória é `recuperar → perceber → planejar → agir → avaliar → persistir`. Os **3 presets cobrem o ciclo completo**: `recall` (recuperar) + nós da arquitetura (perceber/planejar/agir) + `evaluate` ou `critic` (avaliar) + `persist` (persistir). Diferenças: ReAct funde perceber/planejar/agir no `agent`; Plan-Execute usa memória enxuta (só filtro: LONGA+EPISÓDICA); Reflection usa o `critic` como fase avaliar + memória completa. `evaluate` é fail-open (registra qualidade, nunca bloqueia). Mapa em `docs/learning.md`.

### Quando usar
Antes de escrever o grafo. Escolha a arquitetura pela natureza do problema (caminho aberto vs previsível vs qualidade crítica), depois scaffold com `/scaffold-architecture`.

---

## 15. Comportamento Verificado por Harness

### O que é
Agente é **não-determinístico**: mesma entrada, saída diferente. Você não confia em `assert` booleano — define o comportamento esperado num **contrato** (YAML), roda um **runner** que pontua com scores contínuos (0..1) e LLM-as-judge, e captura traces.

### Problema que resolve
Sem harness, não dá pra saber se o agente melhorou ou piorou entre versões. "Funcionou no meu teste" não é medição.

### Como aparece no projeto

```
packages/harness/
  contracts/*.yaml   → 1 spec por capability (5 variações: happy/edge/adversarial/ambiguous/wrong_tool)
  contract.schema.ts → Zod valida o PRÓPRIO contrato (Schema-First, P5, no contrato)
  evaluate.ts        → funções PURAS de scoring (P6) — testáveis sem LLM
  judges.ts          → LLM-as-judge, output validado por Zod
  runner.ts          → genérico; recebe o agente via InvokeAgent (P2 DI)
  tracer.ts          → callback Langfuse (observabilidade)
```

```typescript
// evaluate.ts — puro, igual edge-conditions. Testável:
expect(checkParams({ nome: 'produto X' }, { nome: 'contains:produto X' })).toBe(1.0)
```

### Relação com P14 e P16
Harness mede as três coisas: qualidade da arquitetura (P14 — comparar react vs plan no Langfuse), corretude do comportamento (contratos), e qualidade da memória (P16 — cenários BOA/IRRELEVANTE/PERIGOSA).

### Quando usar
Sempre que o sistema usar LLM em produção. Ordem: Langfuse → 1 contrato do caso crítico → runner → expandir contratos.

---

## 16. Governança de Memória (4 tipos)

### O que é
Agentes têm 4 tipos de memória, cada um com função, ciclo de vida e implementação próprios. Um contrato `memory.md` **declara a política de cada tipo** — não fica implícita no código.

### Problema que resolve
Memória mal configurada custa tokens ou faz o agente errar. Sem política explícita, ninguém sabe o que é lembrado, por quanto tempo, nem com que limiar de relevância.

### Os 4 tipos

| Tipo | Função | Ciclo de vida | impl | Metáfora |
|---|---|---|---|---|
| **CURTA** | estado da execução | morre com a execução | `local` (state) | mesa de trabalho |
| **LONGA** | fatos confirmados | persiste sempre | `arquivo` (pg) | caderno |
| **EPISÓDICA** | resumos de execuções | tempo configurável (ttl) | `arquivo` (pg) | diário |
| **CONTEXTUAL** | fragmentos por similaridade | sob demanda | `embedding` (pgvector) | google interno |

### Como aparece no projeto

```
memory.md                       → contrato: política dos 4 tipos (validado por Zod)
packages/memory/
  long-term-memory.service.ts   → LONGA
  episodic-memory.service.ts    → EPISÓDICA (ttl + purgeExpired)
  contextual-memory.service.ts  → CONTEXTUAL (limiar + max_fragmentos)
  memory.schema.ts              → Schema-First no contrato de memória
# CURTA não tem service — vive no state do grafo (messages).
```

### Os 3 cenários (medir, não intuir)

```
BOA          → memória ajudou (menos passos)        → objetivo
IRRELEVANTE  → fragmentos inúteis poluem contexto    → política: limiar, max_fragmentos
PERIGOSA     → fato desatualizado → resposta errada  → política: ttl_dias, purgeExpired()
```

### Relação com P15
A qualidade da memória é **medida pelo harness** (contratos), não confiada à intuição. "Só medindo pra saber em qual cenário você está."

### Quando usar
Sempre que o agente precisar lembrar algo além da execução atual. Comece com CURTA (default), ligue os outros tipos via `memory.md` + `/craft-memory` só quando houver necessidade comprovada.

---

## 17. Spec-Driven Development

### O que é
Define o **comportamento esperado** (O QUÊ) numa spec legível antes de escrever código. É o par do P15 (Harness): spec define o quê, harness define como verificar.

### Problema que resolve
Craft de nós sem spec gera código tecnicamente correto mas sem âncora de intenção — e o eval sai solto, desalinhado do que o nó deveria fazer. A spec dá alvo aos craft-nodes e fonte ao contrato de eval.

### Como aparece no projeto

```
spec.template.md                      → modelo do spec
presets/<preset>/specs/<cap>.spec.md  → spec da capability (O QUÊ)
packages/harness/contracts/<cap>.yaml → contrato derivado do spec (COMO VERIFICAR)
```

As 5 variações de eval na spec (happy/edge/adversarial/ambiguous/wrong_tool) viram quase diretamente o contrato YAML.

### O fluxo

```
/craft-spec       ← define comportamento + variações de eval
   ↓
/craft-* (nós)    ← implementam com a spec como alvo
   ↓
/craft-contract   ← deriva da spec
   ↓
/check-principles
```

### Relação com P14 e P15
P14 escolhe a arquitetura; a spec registra essa escolha + o comportamento; P15 (harness) verifica que o comportamento bate. Os três fecham o ciclo: decidir → especificar → verificar.

### Quando usar
Antes de adicionar qualquer capability nova a um preset. Spec primeiro = menos retrabalho, eval alinhado.

---

## Para Aprofundar

| Padrão | Livro / Recurso |
|---|---|
| Factory, Strategy e outros GoF | *Design Patterns* — Gang of Four |
| SoC, DI, SOLID | *Clean Architecture* — Robert C. Martin |
| Configuration as Code | *The Twelve-Factor App* — https://12factor.net |
| Imutabilidade e estado | *Designing Data-Intensive Applications* — Martin Kleppmann |
| Schema-First / Contract-First | *API Design Patterns* — JJ Geewax |
| Pure Functions | *Mostly Adequate Guide to Functional Programming* — Professor Frisby (gratuito online) |
| Spec-Driven Development | material da pós: `harness-engineering.md` (spec define O QUÊ) |
