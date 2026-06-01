// Tools do agente ReAct. ADAPTE ao seu domínio.
// Cada tool = uma ação que o agente pode escolher chamar no loop raciocínio↔ação.
// Schema-First: os args são validados por Zod (LangChain usa pra montar o tool schema).
import { tool } from '@langchain/core/tools'
import { z } from 'zod/v3'

// Exemplo: catálogo fake só pra demonstrar o loop. Troque por I/O real (DB, API).
const CATALOGO: Record<string, { preco: number; disponivel: boolean }> = {
  'produto x': { preco: 199.9, disponivel: true },
}

export const buscarProduto = tool(
  async ({ nome }: { nome: string }) => {
    const item = CATALOGO[nome.trim().toLowerCase()]
    if (!item) return JSON.stringify({ encontrado: false, mensagem: 'produto não encontrado' })
    return JSON.stringify({ encontrado: true, ...item })
  },
  {
    name: 'buscar_produto',
    description: 'Busca um produto pelo nome e retorna preço e disponibilidade.',
    schema: z.object({ nome: z.string().describe('nome do produto a buscar') }),
  },
)

export const finalizarPedido = tool(
  async ({ nome }: { nome: string }) => {
    return JSON.stringify({ pedido_criado: true, produto: nome })
  },
  {
    name: 'finalizar_pedido',
    description: 'Finaliza a compra de um produto. Só chame se o usuário pedir explicitamente.',
    schema: z.object({ nome: z.string() }),
  },
)

export const cancelarPedido = tool(
  async ({ pedidoId }: { pedidoId: string }) => {
    return JSON.stringify({ cancelado: true, pedidoId })
  },
  {
    name: 'cancelar_pedido',
    description: 'Cancela um pedido existente pelo ID. Não confundir com cancelar uma busca.',
    schema: z.object({ pedidoId: z.string() }),
  },
)

export const tools = [buscarProduto, finalizarPedido, cancelarPedido]
