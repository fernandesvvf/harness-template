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
