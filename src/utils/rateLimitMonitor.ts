import type { Client } from "discord.js";
import { logger } from "./logger";

/**
 * Sets up rate limit monitoring using Discord.js built-in events
 * This provides real-time visibility into rate limit usage
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

  // Log when bot is ready to track rate limit monitoring setup
  logger.info("Rate limit monitoring enabled");
}
