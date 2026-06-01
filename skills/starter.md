# Starter Skills

Skills que criam projetos do zero a partir do Orion como referência canônica.

**Templates disponíveis:**

| Template | Quando usar |
|---|---|
| `template/` | Qualquer agente simples — fluxo mínimo |
| `template-chat-dual-memory/` | Agente conversacional com memória de preferências entre sessões |
| `template-rag-naive/` | Aprender RAG ou protótipos rápidos sem infra externa |
| `template-rag-vector/` | RAG em produção com vector DB (Pinecone, Qdrant, pgvector) |
| `template-rag-neo4j/` | Perguntas analíticas sobre grafo Neo4j |
| `template-agentic-rag/` | Perguntas imprevisíveis que exigem múltiplas fontes e raciocínio dinâmico |

A skill escolhe o template correto baseada nas respostas do discovery.

---

## `/build-agent`

**Quando usar:** Ponto de entrada padrão — sempre ao iniciar qualquer projeto novo.

Conduz uma sessão de discovery (perguntas sobre domínio, dados, segurança, complexidade),
propõe arquitetura combinando os padrões necessários, aguarda aprovação e scaffolda o projeto.

**Processo:**
1. Discovery: domínio, usuários, dados, necessidade de guardrails, tipo de persistência
2. Proposta de arquitetura com justificativa (baseada nos padrões do Orion)
3. Aguarda confirmação antes de criar qualquer arquivo
4. Scaffolda projeto seguindo a estrutura canônica do Orion
5. Entrega checklist de próximos passos

---

## `/new-langgraph-agent`

**Quando usar:** Quando já sabe que quer um agente LangGraph + OpenRouter, sem necessidade de discovery.

Scaffolda diretamente a estrutura do Orion adaptada ao domínio informado.

**O que gera:**
```
src/
├── config.ts                    # Versões e env vars canônicas
├── agent/
│   ├── factory.ts               # Único ponto de instanciação
│   ├── graph.ts                 # Estado Zod + edges (API 1.1.x)
│   └── nodes/
│       ├── <dominio>.node.ts    # Nó principal adaptado
│       └── edge-conditions.ts
├── services/
│   └── openrouter.service.ts    # Cliente LLM com fallback
└── prompts/
    └── v1/
        └── <dominio>.prompt.ts  # Schema + prompts versionados
```

**package.json gerado com versões canônicas:**
```json
{
  "@langchain/core": "^1.1.22",
  "@langchain/langgraph": "1.1.3",
  "@langchain/openai": "^1.2.9",
  "langchain": "1.2.25",
  "zod": "^3.24.1"
}
```

**tsconfig.json gerado com configuração obrigatória:**
```json
{ "compilerOptions": { "moduleResolution": "node", "exactOptionalPropertyTypes": false } }
```
