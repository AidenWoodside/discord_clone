/**
 * Retries a function on transient Postgres connection errors.
 * Only retries codes: 08006 (connection_failure), 08001 (unable_to_establish),
 * 57P01 (admin_shutdown — Supabase maintenance).
 * Constraint violations and other non-transient errors are never retried.
 */
export async function withDbRetry<T>(
  fn: () => Promise<T>,
  { maxRetries = 1, delayMs = 200 } = {},
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      const pgErr = err as { code?: string };
      const isTransient = pgErr.code === '08006' || // connection_failure
                          pgErr.code === '08001' || // sqlclient_unable_to_establish
                          pgErr.code === '57P01';    // admin_shutdown (Supabase maintenance)
      if (!isTransient || attempt === maxRetries) throw err;
      await new Promise(r => setTimeout(r, delayMs * (attempt + 1)));
    }
  }
  throw new Error('unreachable');
}
