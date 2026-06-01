// benchmark-runner — roda o MESMO dataset contra N arquiteturas e compara métricas.
// Fecha o P14 com dados: ReAct vs Plan-Execute vs Reflection lado a lado.
//
// Coleta por arquitetura: conclusão, etapas, TOKENS (custo), tempo, cobertura de tools.
// Inspirado no benchmark.py da aula (monitor-agent).
import { writeFileSync } from 'node:fs'
import { loadDataset } from './dataset-runner.js'
import type { Observed } from './scorers.js'
import { resetTokens, snapshotTokens } from './token-meter.js'

/** O preset roda 1 caso e devolve o que observou + se concluiu. */
export type InvokeForBenchmark = (entrada: string) => Promise<{ obs: Observed; concluido: boolean }>

interface CaseMetric {
  casoId: string
  concluido: boolean
  tokens: number
  tokensPrompt: number
  tempoMs: number
  toolsChamadas: number
  cobertura: number // % das tools_esperadas chamadas (se o caso declarar)
}

export interface BenchmarkResult {
  arquitetura: string
  cenarios: number
  taxaConclusao: number
  mediaTokens: number
  mediaTokensPrompt: number
  mediaTempoMs: number
  coberturaFerramentas: number
  porCenario: CaseMetric[]
}

function cobertura(esperadas: string[] | undefined, chamadas: string[]): number {
  if (!esperadas || esperadas.length === 0) return 100
  const set = new Set(chamadas)
  const hits = esperadas.filter((t) => set.has(t)).length
  return Math.round((hits / esperadas.length) * 1000) / 10
}

/** Roda 1 arquitetura contra o dataset inteiro. */
export async function runBenchmark(
  arquitetura: string,
  datasetPath: string,
  invoke: InvokeForBenchmark,
): Promise<BenchmarkResult> {
  const ds = loadDataset(datasetPath)
  const porCenario: CaseMetric[] = []

  for (const caso of ds.casos) {
    const esperadas = ds.tipo === 'tool_selection' ? (caso as { tools_esperadas?: string[] }).tools_esperadas : undefined
    resetTokens()
    const t0 = Date.now()
    let obs: Observed = { memoriaRecuperada: { fatos: [], episodios: [], licoes: [] }, toolsChamadas: [], output: '' }
    let concluido = false
    try {
      const r = await invoke(caso.entrada)
      obs = r.obs
      concluido = r.concluido
    } catch {
      concluido = false
    }
    const tokens = snapshotTokens()
    porCenario.push({
      casoId: caso.id,
      concluido,
      tokens: tokens.total,
      tokensPrompt: tokens.prompt,
      tempoMs: Date.now() - t0,
      toolsChamadas: obs.toolsChamadas.length,
      cobertura: cobertura(esperadas, obs.toolsChamadas),
    })
    console.log(`  [${arquitetura}/${caso.id}] tokens=${tokens.total} tempo=${Date.now() - t0}ms concluido=${concluido}`)
  }

  const n = porCenario.length || 1
  const avg = (sel: (m: CaseMetric) => number) => Math.round(porCenario.reduce((a, m) => a + sel(m), 0) / n)
  return {
    arquitetura,
    cenarios: porCenario.length,
    taxaConclusao: Math.round((porCenario.filter((m) => m.concluido).length / n) * 1000) / 10,
    mediaTokens: avg((m) => m.tokens),
    mediaTokensPrompt: avg((m) => m.tokensPrompt),
    mediaTempoMs: avg((m) => m.tempoMs),
    coberturaFerramentas: Math.round((porCenario.reduce((a, m) => a + m.cobertura, 0) / n) * 10) / 10,
    porCenario,
  }
}

/** Gera report.md comparativo. Marca o melhor por métrica + veredito. */
export function gerarReport(resultados: BenchmarkResult[], caminhoSaida: string): void {
  const md: string[] = ['# Benchmark Comparativo de Arquiteturas', '']
  if (resultados.length === 0) {
    writeFileSync(caminhoSaida, 'Nenhum resultado.\n')
    return
  }
  md.push(`**Cenários:** ${resultados[0]!.cenarios}`, '')
  md.push('## Comparativo', '')
  md.push('| Métrica | ' + resultados.map((r) => r.arquitetura).join(' | ') + ' |')
  md.push('|' + '---|'.repeat(resultados.length + 1))

  const linhas: { nome: string; sel: (r: BenchmarkResult) => number; sufixo: string; menorMelhor: boolean }[] = [
    { nome: 'Taxa conclusão', sel: (r) => r.taxaConclusao, sufixo: '%', menorMelhor: false },
    { nome: 'Média tokens', sel: (r) => r.mediaTokens, sufixo: '', menorMelhor: true },
    { nome: 'Tokens prompt', sel: (r) => r.mediaTokensPrompt, sufixo: '', menorMelhor: true },
    { nome: 'Média tempo', sel: (r) => r.mediaTempoMs, sufixo: 'ms', menorMelhor: true },
    { nome: 'Cobertura ferramentas', sel: (r) => r.coberturaFerramentas, sufixo: '%', menorMelhor: false },
  ]

  for (const l of linhas) {
    const nums = resultados.map(l.sel)
    const melhor = l.menorMelhor ? Math.min(...nums) : Math.max(...nums)
    const cels = resultados.map((r) => {
      const v = l.sel(r)
      const txt = `${v}${l.sufixo}`
      return resultados.length > 1 && v === melhor ? `**${txt}**` : txt
    })
    md.push(`| ${l.nome} | ${cels.join(' | ')} |`)
  }
  md.push('')

  if (resultados.length > 1) {
    const maisEficiente = resultados.reduce((a, b) => (b.mediaTokens < a.mediaTokens ? b : a))
    const maisRapido = resultados.reduce((a, b) => (b.mediaTempoMs < a.mediaTempoMs ? b : a))
    const maiorCobertura = resultados.reduce((a, b) => (b.coberturaFerramentas > a.coberturaFerramentas ? b : a))
    md.push('## Veredito', '')
    md.push(`- **Mais eficiente (tokens):** ${maisEficiente.arquitetura}`)
    md.push(`- **Mais rápido:** ${maisRapido.arquitetura}`)
    md.push(`- **Maior cobertura:** ${maiorCobertura.arquitetura}`)
    md.push('')
  }

  writeFileSync(caminhoSaida, md.join('\n'))
  console.log(`\n  Relatório salvo: ${caminhoSaida}`)
}
