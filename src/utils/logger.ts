import { formatIsoTimestamp, systemTimestampSource, type TimestampSource } from './time.js';

export const logLevels = ['debug', 'info', 'warn', 'error', 'silent'] as const;

export type LogLevel = (typeof logLevels)[number];
export type ActiveLogLevel = Exclude<LogLevel, 'silent'>;

export interface LogMetadata {
  [key: string]: unknown;
}

export interface LogRecord {
  level: ActiveLogLevel;
  message: string;
  scope?: string;
  timestamp: string;
  metadata?: LogMetadata;
}

export interface Logger {
  level: LogLevel;
  scope?: string;
  child(scope: string): Logger;
  debug(message: string, metadata?: LogMetadata): void;
  info(message: string, metadata?: LogMetadata): void;
  warn(message: string, metadata?: LogMetadata): void;
  error(message: string, metadata?: LogMetadata): void;
}

export interface LoggerSink {
  (record: LogRecord): void;
}

export interface CreateLoggerOptions {
  level?: LogLevel;
  scope?: string;
  sink?: LoggerSink;
  timestampSource?: TimestampSource;
}

export interface StreamLogSinkOptions {
  stdout?: { write(chunk: string): void };
  stderr?: { write(chunk: string): void };
}

const logLevelWeight: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 50
};

function isEnabled(configuredLevel: LogLevel, attemptedLevel: ActiveLogLevel): boolean {
  return logLevelWeight[attemptedLevel] >= logLevelWeight[configuredLevel];
}

function mergeScopes(parentScope: string | undefined, childScope: string): string {
  return parentScope ? `${parentScope}:${childScope}` : childScope;
}

export function formatLogRecord(record: LogRecord): string {
  const parts = [`[${record.timestamp}]`, record.level.toUpperCase()];

  if (record.scope) {
    parts.push(`[${record.scope}]`);
  }

  parts.push(record.message);

  if (record.metadata && Object.keys(record.metadata).length > 0) {
    parts.push(JSON.stringify(record.metadata));
  }

  return parts.join(' ');
}

export function createStreamLogSink(options: StreamLogSinkOptions = {}): LoggerSink {
  const stdout = options.stdout ?? process.stdout;
  const stderr = options.stderr ?? process.stderr;

  return (record) => {
    const formattedRecord = `${formatLogRecord(record)}\n`;

    if (record.level === 'warn' || record.level === 'error') {
      stderr.write(formattedRecord);
      return;
    }

    stdout.write(formattedRecord);
  };
}

export function createLogger(options: CreateLoggerOptions = {}): Logger {
  const level = options.level ?? 'info';
  const scope = options.scope;
  const sink = options.sink ?? createStreamLogSink();
  const timestampSource = options.timestampSource ?? systemTimestampSource;

  function write(levelName: ActiveLogLevel, message: string, metadata?: LogMetadata): void {
    if (!isEnabled(level, levelName)) {
      return;
    }

    const record: LogRecord = {
      level: levelName,
      message,
      timestamp: formatIsoTimestamp(timestampSource.now())
    };

    if (scope) {
      record.scope = scope;
    }

    if (metadata) {
      record.metadata = metadata;
    }

    sink(record);
  }

  const logger: Logger = {
    level,
    child(childScope: string): Logger {
      return createLogger({
        level,
        scope: mergeScopes(scope, childScope),
        sink,
        timestampSource
      });
    },
    debug(message: string, metadata?: LogMetadata): void {
      write('debug', message, metadata);
    },
    info(message: string, metadata?: LogMetadata): void {
      write('info', message, metadata);
    },
    warn(message: string, metadata?: LogMetadata): void {
      write('warn', message, metadata);
    },
    error(message: string, metadata?: LogMetadata): void {
      write('error', message, metadata);
    }
  };

  if (scope) {
    logger.scope = scope;
  }

  return logger;
}