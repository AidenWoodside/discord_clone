import { describe, it, expect, vi } from 'vitest';
import { withDbRetry } from './withDbRetry.js';

function makePgError(code: string, message = 'pg error'): Error {
  const err = new Error(message);
  (err as { code?: string }).code = code;
  return err;
}

describe('withDbRetry', () => {
  it('returns result on first success', async () => {
    const result = await withDbRetry(() => Promise.resolve('ok'));
    expect(result).toBe('ok');
  });

  it('retries on connection_failure (08006)', async () => {
    let attempts = 0;
    const fn = async () => {
      attempts++;
      if (attempts === 1) throw makePgError('08006');
      return 'recovered';
    };
    const result = await withDbRetry(fn);
    expect(result).toBe('recovered');
    expect(attempts).toBe(2);
  });

  it('retries on sqlclient_unable_to_establish (08001)', async () => {
    let attempts = 0;
    const fn = async () => {
      attempts++;
      if (attempts === 1) throw makePgError('08001');
      return 'recovered';
    };
    const result = await withDbRetry(fn);
    expect(result).toBe('recovered');
    expect(attempts).toBe(2);
  });

  it('retries on admin_shutdown (57P01) — Supabase maintenance', async () => {
    let attempts = 0;
    const fn = async () => {
      attempts++;
      if (attempts === 1) throw makePgError('57P01');
      return 'recovered';
    };
    const result = await withDbRetry(fn);
    expect(result).toBe('recovered');
    expect(attempts).toBe(2);
  });

  it('does NOT retry on unique_violation (23505)', async () => {
    const fn = vi.fn().mockRejectedValue(makePgError('23505', 'unique violation'));
    await expect(withDbRetry(fn)).rejects.toThrow('unique violation');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does NOT retry on foreign_key_violation (23503)', async () => {
    const fn = vi.fn().mockRejectedValue(makePgError('23503', 'fk violation'));
    await expect(withDbRetry(fn)).rejects.toThrow('fk violation');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does NOT retry on non-pg errors', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('random error'));
    await expect(withDbRetry(fn)).rejects.toThrow('random error');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('throws after exhausting retries on persistent transient errors', async () => {
    const fn = vi.fn().mockRejectedValue(makePgError('08006', 'connection lost'));
    await expect(withDbRetry(fn, { maxRetries: 2 })).rejects.toThrow('connection lost');
    expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it('applies linear backoff delay between retries', async () => {
    vi.useFakeTimers();
    let attempts = 0;
    const fn = async () => {
      attempts++;
      if (attempts <= 2) throw makePgError('08006');
      return 'ok';
    };

    const promise = withDbRetry(fn, { maxRetries: 2, delayMs: 100 });

    // First attempt fails immediately, then waits 100ms
    await vi.advanceTimersByTimeAsync(100);
    // Second attempt fails, then waits 200ms
    await vi.advanceTimersByTimeAsync(200);

    const result = await promise;
    expect(result).toBe('ok');
    expect(attempts).toBe(3);
    vi.useRealTimers();
  });
});
