import type { Client } from "discord.js";
import { DiscordAPIError } from "discord.js";
import { logger } from "./logger";

/**
 * Discord API Rate Limiting Monkey Patch
 *
 * This module patches Discord.js's REST client to automatically handle rate limiting
 * on ALL API calls. No manual wrapping required - just use Discord.js normally!
 *
 * Features:
 * - Automatically intercepts all Discord API calls
 * - Detects HTTP 429 rate limit responses
 * - Retries with exponential backoff (up to 3 times)
 * - Auto-generates context from API route for logging
 * - Works transparently with all Discord.js operations
 *
 * Usage:
 * ```typescript
 * import { patchDiscordRateLimiting } from './utils/discordApiPatch';
 * patchDiscordRateLimiting(client); // Call once on startup
 *
 * // Then use Discord.js normally - rate limiting is automatic!
 * await channel.send({ content: 'Hello!' });
 * await message.edit({ embeds: [embed] });
 * ```
 */

interface RateLimitError {
  message: string;
  retry_after: number;
  global: boolean;
  code?: number;
}

function isAbortError(error: unknown): boolean {
  if (!error) return false;
  const err = error as any;

  const code = typeof err.code === "string" ? err.code.toUpperCase() : err.code;
  if (err.name === "AbortError" || code === "ABORT_ERR") {
    return true;
  }

  const message = typeof err.message === "string" ? err.message.toLowerCase() : "";
  return message.includes("aborted");
}

/**
 * Sleeps for the specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Extracts a meaningful context from the request details
 */
function extractContext(method: string, route: string, _options?: any): string {
  // Clean up route for better readability
  const cleanRoute = route
    .replace(/\/\d+/g, "/:id") // Replace IDs with :id
    .replace(/\/channels\/\d+/, "/channels/:id")
    .replace(/\/guilds\/\d+/, "/guilds/:id")
    .replace(/\/users\/\d+/, "/users/:id")
    .replace(/\/messages\/\d+/, "/messages/:id");

  return `${method} ${cleanRoute}`;
}

/**
 * Wraps an async function with rate limit retry logic
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  context: string,
  maxRetries: number = 3,
): Promise<T> {
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

      if (isAbortError(error)) {
        const retryDelay = Math.min(2000 * (attempt + 1), 5000);
        logger.warn(
          {
            context,
            attempt: attempt + 1,
            maxRetries: maxRetries + 1,
            retryDelayMs: retryDelay,
          },
          "Discord REST request aborted mid-flight. Retrying...",
        );

        if (attempt < maxRetries) {
          await sleep(retryDelay);
          continue;
        }

        logger.error({ context }, "Max retries exceeded for aborted REST request");
        throw error;
      }

      // If it's not a rate limit error, throw immediately
      throw error;
    }
  }

  throw new Error("Unexpected error in rate limit retry logic");
}

/**
 * Applies a monkey patch to Discord.js REST client to automatically handle rate limits
 * This intercepts all REST API calls and wraps them with retry logic
 */
export function patchDiscordRateLimiting(client: Client): void {
  const restClient = client.rest as any;
  const originalRequest = restClient.request;

  if (!originalRequest) {
    logger.warn("Could not patch Discord REST client - request method not found");
    return;
  }

  // Track if already patched
  if (restClient.__rateLimitPatched) {
    logger.debug("Discord REST client already patched for rate limiting");
    return;
  }

  // Replace the request method with our wrapped version
  restClient.__originalRequest = originalRequest;
  restClient.request = async function (options: any) {
    const method = options.method || "GET";
    const route = options.path || options.url || "unknown";
    const context = extractContext(method, route, options);

    // Wrap the original request with retry logic
    return withRetry(() => originalRequest.call(this, options), context, 3);
  };

  // Mark as patched
  restClient.__rateLimitPatched = true;

  logger.info("Discord REST client patched for automatic rate limit handling");
}

/**
 * Removes the monkey patch (for testing or cleanup)
 */
export function unpatchDiscordRateLimiting(client: Client): void {
  const restClient = client.rest as any;
  if (restClient.__originalRequest) {
    restClient.request = restClient.__originalRequest;
    delete restClient.__originalRequest;
    delete restClient.__rateLimitPatched;
    logger.info("Discord REST client rate limit patch removed");
  }
}
