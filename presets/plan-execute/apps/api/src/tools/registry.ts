// Registro de tools executáveis. O executor roda por NOME, sem LLM (P14 Plan-Execute).
// ADAPTE: troque por I/O real do seu domínio.
export type ToolFn = (args: Record<string, unknown>) => Promise<unknown>

const CATALOGO: Record<string, { preco: number; disponivel: boolean }> = {
  'produto x': { preco: 199.9, disponivel: true },
  'produto y': { preco: 49.5, disponivel: true },
}

export const toolRegistry: Record<string, ToolFn> = {
  async buscar_produto(args) {
    const nome = String(args.nome ?? '').trim().toLowerCase()
    const item = CATALOGO[nome]
    return item ? { nome, ...item } : { nome, encontrado: false }
  },

  async calcular_total(args) {
    const itens = (args.itens as string[] | undefined) ?? []
    const total = itens.reduce((sum, n) => sum + (CATALOGO[n.trim().toLowerCase()]?.preco ?? 0), 0)
    return { itens, total }
  },
}
