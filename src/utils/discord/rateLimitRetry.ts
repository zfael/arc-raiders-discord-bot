import type { Client } from "discord.js";
import { DiscordAPIError } from "discord.js";
import { logger } from "../logger";

/**
 * Discord API Rate Limit Handler
 *
 * This module provides two complementary rate limit handling mechanisms:
 *
 * 1. **Monitoring** (`setupRateLimitMonitoring`): Passive logging of rate limit events
 *    using Discord.js built-in events for visibility.
 *
 * 2. **Retry** (`enableRateLimitRetry`): Active retry logic that automatically
 *    retries failed requests after rate limit delays.
 *
 * Usage:
 * ```typescript
 * import { enableRateLimitRetry, setupRateLimitMonitoring } from './utils/discord/rateLimitRetry';
 *
 * // Enable both on startup
 * setupRateLimitMonitoring(client);  // Passive logging
 * enableRateLimitRetry(client);       // Active retry
 *
 * // Then use Discord.js normally - rate limiting is automatic!
 * await channel.send({ content: 'Hello!' });
 * await message.edit({ embeds: [embed] });
 * ```
 */

// ============================================================================
// Rate Limit Monitoring (Passive)
// ============================================================================

/**
 * Sets up rate limit monitoring using Discord.js built-in events.
 * This provides real-time visibility into rate limit usage via logging.
 */
export function setupRateLimitMonitoring(client: Client): void {
  // Emitted when a rate limit is hit
  client.rest.on("rateLimited", (rateLimitInfo) => {
    const {
      timeToReset, // Time until the rate limit resets (milliseconds)
      limit, // Maximum number of requests
      method, // HTTP method (GET, POST, etc.)
      hash, // Route hash identifier
      url, // The URL that was rate limited
      route, // The route being accessed
      majorParameter, // Major parameter (e.g., channel ID, guild ID)
      global, // Whether this is a global rate limit
    } = rateLimitInfo;

    const severity = global ? "GLOBAL" : "ROUTE";
    const resetSeconds = (timeToReset / 1000).toFixed(2);

    logger.warn(
      {
        severity,
        method,
        route,
        url,
        limit,
        timeToReset,
        resetSeconds,
        majorParameter,
        hash,
      },
      `[${severity}] Rate limit hit: ${method} ${route} - waiting ${resetSeconds}s (limit: ${limit})`,
    );
  });

  logger.info("Rate limit monitoring enabled");
}

// ============================================================================
// Rate Limit Retry (Active)
// ============================================================================

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

      // If it's not a rate limit error, throw immediately
      throw error;
    }
  }

  throw new Error("Unexpected error in rate limit retry logic");
}

/**
 * Enables automatic rate limit retry handling on the Discord.js REST client.
 * This intercepts all REST API calls and wraps them with retry logic.
 */
export function enableRateLimitRetry(client: Client): void {
  const restClient = client.rest as any;
  const originalRequest = restClient.request;

  if (!originalRequest) {
    logger.warn("Could not enable rate limit retry - request method not found");
    return;
  }

  // Track if already enabled
  if (restClient.__rateLimitRetryEnabled) {
    logger.debug("Rate limit retry already enabled");
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

  // Mark as enabled
  restClient.__rateLimitRetryEnabled = true;

  logger.info("Rate limit retry enabled for Discord REST client");
}

/**
 * Disables automatic rate limit retry handling (for testing or cleanup)
 */
export function disableRateLimitRetry(client: Client): void {
  const restClient = client.rest as any;
  if (restClient.__originalRequest) {
    restClient.request = restClient.__originalRequest;
    delete restClient.__originalRequest;
    delete restClient.__rateLimitRetryEnabled;
    logger.info("Rate limit retry disabled for Discord REST client");
  }
}
