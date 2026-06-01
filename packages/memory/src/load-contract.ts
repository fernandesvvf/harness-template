// Carrega e valida o memory.md de um projeto.
// O memory.md tem um bloco de frontmatter YAML com a política dos 4 tipos.
import { readFileSync } from 'node:fs'
import { parse as parseYaml } from 'yaml'
import { MemoryContractSchema, type MemoryContract } from './memory.schema.js'

/** Extrai o bloco YAML entre as primeiras cercas ```yaml ... ``` do memory.md. */
function extractYaml(md: string): string {
  const match = md.match(/```ya?ml\s*\n([\s\S]*?)\n```/)
  if (!match) throw new Error('memory.md: bloco ```yaml``` de política não encontrado')
  return match[1]!
}

export function loadMemoryContract(path: string): MemoryContract {
  const yaml = extractYaml(readFileSync(path, 'utf8'))
  return MemoryContractSchema.parse(parseYaml(yaml)) // lança se inválido
}
