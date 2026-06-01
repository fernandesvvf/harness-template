---
description: Cria o spec (O QUÊ) de uma capability ANTES de construir os nós — fonte do contrato de eval
argument-hint: <capability>
---

## Contexto
Spec-Driven Development: define o comportamento esperado antes do código.
É o par do harness — spec define O QUÊ, harness define COMO VERIFICAR.
Referência: `spec.template.md` (raiz), `harness-engineering.md`, `PATTERNS.md` P14/P15/P17.
Saída: `presets/<preset>/specs/<capability>.spec.md`.

## Perguntas (uma por vez)
1. Qual capability? (uma frase do objetivo)
2. Em qual preset? (react | plan-execute | reflection) — e por quê (natureza do problema)
3. Input e output esperados?
4. Quais tools pode usar? Quais NÃO pode (proibidas)?
5. Regras de negócio inegociáveis?
6. Usa memória? Quais tipos e como (LONGA/EPISÓDICA/CONTEXTUAL)?
7. Modos de falha e teto de loop?

## Padrão Obrigatório

### CORRETO ✅
- Spec descreve COMPORTAMENTO, não implementação (sem nome de função/arquivo).
- As 5 variações de eval preenchidas → o contrato YAML cai quase de graça.
- Tools proibidas explícitas (ex: ação destrutiva sem confirmação).
- Memória declarada por tipo (alinha com `memory.md`).
- Definition of Done verificável.

### ERRADO ❌
- Pular o spec e ir direto pro `/craft-llm-node`. // ❌ código sem âncora de intenção
- Spec que descreve código ("a função X chama Y"). // ❌ é design, não implementação
- Variações de eval vazias. // ❌ contrato não deriva, eval fica solto

## Fluxo (onde o spec entra)
```
/craft-spec <capability>            ← O QUÊ (este comando)
   ↓
/craft-prompt → /craft-llm-node (ou /craft-io-node)
   → /craft-edge-conditions → /craft-graph-state → /craft-factory
   ↓
/craft-contract <capability>        ← COMO VERIFICAR (deriva do spec)
   ↓
/check-principles
```

## Passos de Execução
1. Copiar `spec.template.md` → `presets/<preset>/specs/<capability>.spec.md`.
2. Substituir `{{CAPABILITY}}`, `{{SLUG}}` e preencher todas as seções com o usuário.
3. Garantir as 5 variações de eval preenchidas (viram o contrato depois).
4. Revisar com o usuário antes de construir qualquer nó.

## Checklist de Saída
- [ ] `specs/<capability>.spec.md` criado e revisado
- [ ] Arquitetura justificada (P14)
- [ ] Tools permitidas E proibidas listadas
- [ ] Memória declarada por tipo (se usa)
- [ ] 5 variações de eval preenchidas
- [ ] Definition of Done escrita
