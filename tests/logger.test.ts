import { describe, expect, it, vi } from 'vitest';

import {
  createLogger,
  createStreamLogSink,
  formatLogRecord,
  type LogRecord,
  type TimestampSource
} from '../src/index.js';

function createFixedTimestampSource(value: string): TimestampSource {
  return {
    now: () => new Date(value)
  };
}

describe('logging utility', () => {
  it('filters messages below the configured level', () => {
    const sink = vi.fn<(record: LogRecord) => void>();
    const logger = createLogger({
      level: 'warn',
      sink,
      timestampSource: createFixedTimestampSource('2026-04-19T12:00:00.000Z')
    });

    logger.info('skip me');
    logger.warn('keep me');

    expect(sink).toHaveBeenCalledTimes(1);
    expect(sink).toHaveBeenCalledWith({
      level: 'warn',
      message: 'keep me',
      timestamp: '2026-04-19T12:00:00.000Z',
      metadata: undefined,
      scope: undefined
    });
  });

  it('creates child loggers with merged scopes', () => {
    const sink = vi.fn<(record: LogRecord) => void>();
    const logger = createLogger({
      level: 'debug',
      scope: 'spotter',
      sink,
      timestampSource: createFixedTimestampSource('2026-04-19T12:00:00.000Z')
    });

    logger.child('scanner').debug('route scan started', { framework: 'next-app' });

    expect(sink).toHaveBeenCalledWith({
      level: 'debug',
      message: 'route scan started',
      metadata: { framework: 'next-app' },
      scope: 'spotter:scanner',
      timestamp: '2026-04-19T12:00:00.000Z'
    });
  });

  it('formats and routes stream output by severity', () => {
    const stdout = { write: vi.fn<(chunk: string) => void>() };
    const stderr = { write: vi.fn<(chunk: string) => void>() };
    const sink = createStreamLogSink({ stdout, stderr });

    sink({
      level: 'info',
      message: 'config loaded',
      scope: 'spotter:config',
      timestamp: '2026-04-19T12:00:00.000Z',
      metadata: { source: 'spotter.config.json' }
    });

    sink({
      level: 'error',
      message: 'config parse failed',
      scope: 'spotter:config',
      timestamp: '2026-04-19T12:00:00.000Z'
    });

    expect(stdout.write).toHaveBeenCalledWith(
      '[2026-04-19T12:00:00.000Z] INFO [spotter:config] config loaded {"source":"spotter.config.json"}\n'
    );
    expect(stderr.write).toHaveBeenCalledWith(
      '[2026-04-19T12:00:00.000Z] ERROR [spotter:config] config parse failed\n'
    );
  });

  it('formats records consistently', () => {
    expect(
      formatLogRecord({
        level: 'info',
        message: 'baseline complete',
        scope: 'spotter:baseline',
        timestamp: '2026-04-19T12:00:00.000Z',
        metadata: { screenshots: 24 }
      })
    ).toBe(
      '[2026-04-19T12:00:00.000Z] INFO [spotter:baseline] baseline complete {"screenshots":24}'
    );
  });
});