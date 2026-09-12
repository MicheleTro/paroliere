import { describe, expect, it } from 'vitest';
import { formatDuration } from './format.js';

describe('formatDuration', () => {
  it('formats minutes and seconds padded to two digits', () => {
    expect(formatDuration(120_000)).toBe('2:00');
    expect(formatDuration(65_000)).toBe('1:05');
    expect(formatDuration(9_000)).toBe('0:09');
  });

  it('rounds up to the nearest second', () => {
    expect(formatDuration(1)).toBe('0:01');
    expect(formatDuration(59_500)).toBe('1:00');
  });

  it('clamps negative durations to zero', () => {
    expect(formatDuration(-1000)).toBe('0:00');
  });
});
