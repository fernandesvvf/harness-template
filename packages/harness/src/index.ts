// API pública do harness, consumida pelos presets na pasta evals/.
export { runContract, loadContract, type InvokeAgent } from './runner.js'
export { evaluate, evaluateDeterministic, checkParams, type RunResult } from './evaluate.js'
export { runJudge } from './judges.js'
export { startTrace, pushScores, flushTraces } from './tracer.js'
export { ContractSchema, CaseSchema, type Contract, type Case } from './contract.schema.js'

// Eval orientada a dataset (ground-truth objetivo) — complementa os contratos.
export { runDataset, loadDataset, type InvokeForDataset, type DatasetResult } from './dataset-runner.js'
export { scoreMemory, scoreToolSelection, scoreBehavior, type Observed } from './scorers.js'
export {
  DatasetSchema,
  type Dataset,
  type MemoryCaseT,
  type ToolCaseT,
  type BehaviorCaseT,
} from './dataset.schema.js'

// Benchmark comparativo de arquiteturas (roda 1 dataset em N presets).
export { resetTokens, recordTokens, snapshotTokens } from './token-meter.js'
export { runBenchmark, gerarReport, type InvokeForBenchmark, type BenchmarkResult } from './benchmark-runner.js'

// Suites — gate de qualidade declarativo (dataset + limiares).
export { runSuite, loadSuite, type SuiteResult } from './suite-runner.js'
export { SuiteSchema, type Suite } from './suite.schema.js'

// Memory-impact eval — mede o IMPACTO da memória (com vs sem). Prova o cenário BOA.
export { runMemoryEval, type InvokeMemoryEval, type MemoryEvalResult } from './memory-eval-runner.js'
export { scoreMemoryImpact, type MemoryRun } from './memory-eval.js'
