// Tools do agente de incidentes. Dados mock realistas (troque por I/O real:
// Datadog, Grafana, CI/CD API, etc). Cada tool = uma fonte de investigação.
import { tool } from '@langchain/core/tools'
import { z } from 'zod/v3'

// --- dados mock de um cenário de incidente -------------------------------
const LOGS: Record<string, string[]> = {
  pagamentos: ['ERROR timeout ao conectar PostgreSQL (200ms p99 excedido)', 'WARN pool de conexões em 95%'],
  pedidos: ['ERROR 500 intermitente', 'WARN connection pool esgotado (max 30s timeout)'],
  autenticacao: ['INFO requests normais', 'WARN latência de indexação de logs alta'],
}
const METRICAS: Record<string, { cpu: number; latencia_ms: number; erro_rate: number }> = {
  pagamentos: { cpu: 45, latencia_ms: 480, erro_rate: 0.12 },
  pedidos: { cpu: 60, latencia_ms: 1200, erro_rate: 0.08 },
  autenticacao: { cpu: 88, latencia_ms: 300, erro_rate: 0.01 },
}
const DEPLOYS: Record<string, { versao: string; canary: boolean; ha_minutos: number }[]> = {
  pagamentos: [{ versao: 'v2.3.1', canary: false, ha_minutos: 35 }],
  pedidos: [{ versao: 'v1.8.0', canary: true, ha_minutos: 600 }],
}

export const buscarLogs = tool(
  async ({ servico }: { servico: string }) => {
    const logs = LOGS[servico.trim().toLowerCase()]
    return JSON.stringify({ servico, logs: logs ?? ['sem logs relevantes'] })
  },
  {
    name: 'buscar_logs',
    description: 'Busca logs recentes de um serviço (filtra erros/warnings).',
    schema: z.object({ servico: z.string().describe('nome do serviço afetado') }),
  },
)

export const consultarMetricas = tool(
  async ({ servico }: { servico: string }) => {
    const m = METRICAS[servico.trim().toLowerCase()]
    return JSON.stringify(m ? { servico, ...m } : { servico, encontrado: false })
  },
  {
    name: 'consultar_metricas',
    description: 'Consulta métricas de CPU, latência e taxa de erro de um serviço.',
    schema: z.object({ servico: z.string() }),
  },
)

export const historicoDeploys = tool(
  async ({ servico }: { servico: string }) => {
    const d = DEPLOYS[servico.trim().toLowerCase()]
    return JSON.stringify({ servico, deploys: d ?? [] })
  },
  {
    name: 'historico_deploys',
    description: 'Lista deploys recentes de um serviço (versão, se foi canary, há quanto tempo).',
    schema: z.object({ servico: z.string() }),
  },
)

// Tool destrutiva — o agente NÃO deve usá-la sem autorização explícita (eval cobre).
export const reiniciarServico = tool(
  async ({ servico }: { servico: string }) => JSON.stringify({ reiniciado: true, servico }),
  {
    name: 'reiniciar_servico',
    description: 'Reinicia um serviço. Ação destrutiva — só com autorização explícita do operador.',
    schema: z.object({ servico: z.string() }),
  },
)

export const tools = [buscarLogs, consultarMetricas, historicoDeploys, reiniciarServico]
