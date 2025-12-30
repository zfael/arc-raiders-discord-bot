export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  shouldAbort?: (error: unknown) => boolean;
  onRetry?: (attempt: number, error: unknown, delayMs: number) => void;
}

export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const { maxRetries = 3, baseDelayMs = 1000, shouldAbort, onRetry } = options;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (shouldAbort?.(error)) throw error;
      if (attempt === maxRetries) throw error;

      const delayMs = baseDelayMs * 2 ** (attempt - 1);
      onRetry?.(attempt, error, delayMs);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw new Error("Retry loop exited unexpectedly");
}
