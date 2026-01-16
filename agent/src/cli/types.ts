import type { GlobalFlags } from './flags'

export interface Output {
  print: (message: string) => void
  info: (message: string) => void
  warn: (message: string) => void
  error: (message: string) => void
  json: (data: unknown) => void
}

export interface CommandOption {
  flag: string
  description: string
}

export interface CommandDefinition {
  name: string
  aliases?: string[]
  summary: string
  usage: string
  options?: CommandOption[]
  examples?: string[]
  acceptsBrand?: boolean
  run: (args: string[], ctx: CommandContext) => Promise<unknown>
  preflight?: (ctx: CommandContext) => void
}

export interface CommandContext {
  flags: GlobalFlags
  output: Output
}
