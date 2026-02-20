export interface GlobalFlags {
  help: boolean
  json: boolean
  quiet: boolean
  brand?: string
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
}
