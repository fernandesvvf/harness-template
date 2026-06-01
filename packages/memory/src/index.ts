// API pública do pacote de memória. CURTA não tem service: vive no state do grafo.
export { LongTermMemoryService } from './long-term-memory.service.js'
export { EpisodicMemoryService } from './episodic-memory.service.js'
export {
  ContextualMemoryService,
  type Embedder,
  type ContextualPolicy,
} from './contextual-memory.service.js'
export { loadMemoryContract } from './load-contract.js'
export {
  MemoryContractSchema,
  type MemoryContract,
  type ContextualPolicyT,
  type EpisodicaPolicyT,
} from './memory.schema.js'
export { getPool, closePool } from './pool.js'
