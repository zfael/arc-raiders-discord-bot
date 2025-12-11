import { DiscordAPIError } from "discord.js";
import { logger } from "./logger";

interface RateLimitInfo {
  limit?: number;
  remaining?: number;
  reset?: number;
  resetAfter?: number;
  bucket?: string;
  global?: boolean;
  scope?: string;
}

interface RateLimitError {
  message: string;
  retry_after: number;
  global: boolean;
  code?: number;
}

/**
 * Sleeps for the specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wrapper function that handles rate limiting with automatic retries
 * @param fn The async function to execute
 * @param context Description of what operation is being performed (for logging)
 * @param maxRetries Maximum number of retry attempts (default: 3)
 * @returns The result of the function execution
 */
export async function withRateLimitHandling<T>(
  fn: () => Promise<T>,
  context: string,
  maxRetries: number = 3,
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      // Check if it's a Discord API rate limit error (HTTP 429)
      if (error instanceof DiscordAPIError && error.status === 429) {
        const rateLimitData = error.rawError as RateLimitError;
        const retryAfter = rateLimitData.retry_after || 1;
        const isGlobal = rateLimitData.global || false;
        const scope = isGlobal ? "global" : "per-route";

        logger.warn(
          {
            context,
            attempt: attempt + 1,
            maxRetries: maxRetries + 1,
            retryAfter,
            scope,
            global: isGlobal,
          },
          `Rate limited (${scope}). Retrying after ${retryAfter}s...`,
        );

        if (attempt < maxRetries) {
          // Wait for retry_after duration (convert to milliseconds)
          await sleep(retryAfter * 1000);
          continue;
        } else {
          logger.error(
            {
              context,
              retryAfter,
              scope,
            },
            `Max retries (${maxRetries + 1}) exceeded for rate limit`,
          );
          throw error;
        }
      }

      // If it's not a rate limit error, throw immediately
      throw error;
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError || new Error("Unexpected error in rate limit handler");
}
