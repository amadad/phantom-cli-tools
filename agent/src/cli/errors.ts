export interface ErrorResult {
  status: 'error'
  command?: string
  error: {
    message: string
    code: string
    details?: unknown
  }
}

export enum ExitCode {
  Success = 0,
  Runtime = 1,
  Usage = 2,
  Config = 3
}

export class CliError extends Error {
  readonly code: string
  readonly exitCode: ExitCode
  readonly details?: unknown

  constructor(message: string, code: string, exitCode: ExitCode = ExitCode.Runtime, details?: unknown) {
    super(message)
    this.code = code
    this.exitCode = exitCode
    this.details = details
  }
}

export function toErrorResult(error: unknown, command?: string): ErrorResult {
  if (error instanceof CliError) {
    return {
      status: 'error',
      command,
      error: {
        message: error.message,
        code: error.code,
        details: error.details
      }
    }
  }

  const message = error instanceof Error ? error.message : String(error)
  return {
    status: 'error',
    command,
    error: {
      message,
      code: 'unknown_error'
    }
  }
}

export function handleCliError(error: unknown, command?: string, json?: boolean): void {
  const result = toErrorResult(error, command)
  const exitCode = error instanceof CliError ? error.exitCode : ExitCode.Runtime

  process.exitCode = exitCode

  if (json) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n')
    return
  }

  process.stderr.write(`Error: ${result.error.message}\n`)
  if (result.error.details) {
    process.stderr.write(JSON.stringify(result.error.details, null, 2) + '\n')
  }
}
