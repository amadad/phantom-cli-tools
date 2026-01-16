/**
 * Simple structured logging utility
 * Provides consistent log format across the codebase
 *
 * Usage:
 *   import { log } from './logger'
 *   log.info('generate', 'Starting generation', { topic, brand })
 *   log.error('pipeline', 'Step failed', { step, error: err.message })
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogEntry {
  timestamp: string
  level: LogLevel
  module: string
  message: string
  data?: Record<string, unknown>
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
}

// Get minimum log level from environment
function getMinLevel(): LogLevel {
  const envLevel = process.env.LOG_LEVEL?.toLowerCase() as LogLevel
  if (envLevel && LOG_LEVELS[envLevel] !== undefined) {
    return envLevel
  }
  return process.env.DEBUG ? 'debug' : 'info'
}

// Format a log entry for console output
function formatEntry(entry: LogEntry): string {
  const { timestamp, level, module, message, data } = entry
  const time = timestamp.split('T')[1].split('.')[0] // HH:MM:SS
  const prefix = `[${time}] [${level.toUpperCase().padEnd(5)}] [${module}]`

  if (data && Object.keys(data).length > 0) {
    const dataStr = Object.entries(data)
      .map(([k, v]) => `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`)
      .join(' ')
    return `${prefix} ${message} | ${dataStr}`
  }

  return `${prefix} ${message}`
}

// Create a log function for a specific level
function createLogFn(level: LogLevel) {
  const minLevel = getMinLevel()

  return (module: string, message: string, data?: Record<string, unknown>) => {
    if (LOG_LEVELS[level] < LOG_LEVELS[minLevel]) {
      return
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      module,
      message,
      data
    }

    const output = formatEntry(entry)

    switch (level) {
      case 'error':
        console.error(output)
        break
      case 'warn':
        console.warn(output)
        break
      default:
        console.log(output)
    }
  }
}

// Logger instance
export const log = {
  debug: createLogFn('debug'),
  info: createLogFn('info'),
  warn: createLogFn('warn'),
  error: createLogFn('error')
}

// Convenience: create a module-specific logger
export function createLogger(module: string) {
  return {
    debug: (message: string, data?: Record<string, unknown>) => log.debug(module, message, data),
    info: (message: string, data?: Record<string, unknown>) => log.info(module, message, data),
    warn: (message: string, data?: Record<string, unknown>) => log.warn(module, message, data),
    error: (message: string, data?: Record<string, unknown>) => log.error(module, message, data)
  }
}

// Export for testing
export type { LogLevel, LogEntry }
