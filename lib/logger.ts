export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogEntry {
  level: LogLevel
  message: string
  timestamp: string
  context?: Record<string, unknown>
  error?: unknown
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

const currentLevel: LogLevel = process.env.NODE_ENV === 'production' ? 'warn' : 'debug'

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel]
}

function formatLog(entry: LogEntry): string {
  const timestamp = entry.timestamp
  const level = entry.level.toUpperCase().padEnd(5)
  let message = `[${timestamp}] ${level} ${entry.message}`

  if (entry.context && Object.keys(entry.context).length > 0) {
    message += ` ${JSON.stringify(entry.context)}`
  }

  if (entry.error) {
    const error = entry.error instanceof Error ? entry.error : new Error(String(entry.error))
    message += `\n  Error: ${error.message}\n  Stack: ${error.stack || 'N/A'}`
  }

  return message
}

export function createLogger(context: string) {
  return {
    debug(message: string, data?: Record<string, unknown>) {
      if (!shouldLog('debug')) return
      console.debug(formatLog({ level: 'debug', message, timestamp: new Date().toISOString(), context: { ...data, context } }))
    },

    info(message: string, data?: Record<string, unknown>) {
      if (!shouldLog('info')) return
      console.info(formatLog({ level: 'info', message, timestamp: new Date().toISOString(), context: { ...data, context } }))
    },

    warn(message: string, data?: Record<string, unknown>, error?: unknown) {
      if (!shouldLog('warn')) return
      console.warn(formatLog({ level: 'warn', message, timestamp: new Date().toISOString(), context: { ...data, context }, error }))
    },

    error(message: string, error?: unknown, data?: Record<string, unknown>) {
      if (!shouldLog('error')) return
      console.error(formatLog({ level: 'error', message, timestamp: new Date().toISOString(), context: { ...data, context }, error }))
    },
  }
}

export const logger = {
  debug: (message: string, data?: Record<string, unknown>) => {
    if (!shouldLog('debug')) return
    console.debug(formatLog({ level: 'debug', message, timestamp: new Date().toISOString() }))
  },
  info: (message: string, data?: Record<string, unknown>) => {
    if (!shouldLog('info')) return
    console.info(formatLog({ level: 'info', message, timestamp: new Date().toISOString() }))
  },
  warn: (message: string, data?: Record<string, unknown>, error?: unknown) => {
    if (!shouldLog('warn')) return
    console.warn(formatLog({ level: 'warn', message, timestamp: new Date().toISOString(), data, error }))
  },
  error: (message: string, error?: unknown, data?: Record<string, unknown>) => {
    if (!shouldLog('error')) return
    console.error(formatLog({ level: 'error', message, timestamp: new Date().toISOString(), data, error }))
  },
}
