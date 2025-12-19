# Rate Limiting Implementation

This document explains the rate limiting implementation in the bot to handle Discord API rate limits gracefully.

## Overview

Discord's API has rate limits to prevent abuse. When you exceed these limits, Discord returns a `429 Too Many Requests` response with information about how long to wait before retrying.

**This bot uses a monkey patch approach** that automatically intercepts all Discord API calls and handles rate limiting transparently - no manual wrapping required!

## Rate Limit Headers

Discord includes the following headers in API responses:

- `X-RateLimit-Limit` - The number of requests that can be made
- `X-RateLimit-Remaining` - The number of remaining requests that can be made
- `X-RateLimit-Reset` - Epoch time when the rate limit resets
- `X-RateLimit-Reset-After` - Total time (in seconds) until the rate limit resets
- `X-RateLimit-Bucket` - A unique string denoting the rate limit bucket
- `X-RateLimit-Global` - Returned only on HTTP 429 if it's a global rate limit
- `X-RateLimit-Scope` - Can be `user`, `global`, or `shared`

## Rate Limit Response Structure

When rate limited, Discord returns:

```json
{
  "message": "You are being rate limited.",
  "retry_after": 1.5,
  "global": false,
  "code": 0
}
```

## Implementation

### Monkey Patch (`discordApiPatch.ts`)

The bot **automatically patches Discord.js's REST client** on startup to intercept all API calls and add rate limit & network error handling:

```typescript
import { patchDiscordRateLimiting } from './utils/discordApiPatch';

// In index.ts - automatically done on bot startup
patchDiscordRateLimiting(client);
```

**What it does:**
1. Intercepts all Discord API calls at the REST client level
2. Automatically wraps them with retry logic
3. Detects HTTP 429 responses
4. Waits for `retry_after` duration from Discord's response
5. Detects network errors (aborts, timeouts, connection resets)
6. Retries up to 3 times with automatic exponential backoff
7. Logs detailed information about rate limits and network errors
8. Auto-generates context from API route (e.g., "POST /channels/:id/messages")

**Network Errors Handled:**
- `AbortError` / "This operation was aborted"
- `ETIMEDOUT` - Connection timeout
- `ECONNRESET` - Connection reset by peer
- `ECONNREFUSED` - Connection refused
- `ENETUNREACH` - Network unreachable
- `EAI_AGAIN` - DNS lookup timed out
- Socket hang up errors

**Benefits:**
- ✅ Zero manual wrapping required - just use Discord.js normally
- ✅ Automatic retry on rate limits
- ✅ Automatic retry on network errors with exponential backoff (2s, 4s, 8s)
- ✅ Centralized error handling
- ✅ Detailed logging for monitoring
- ✅ Works with ALL Discord API operations (messages, channels, guilds, etc.)

### Example Usage

You don't need to do anything special - just use Discord.js as normal:

```typescript
// These are automatically protected against rate limits AND network errors
await channel.send({ content: 'Hello!' });
await message.edit({ embeds: [embed] });
await message.pin();
await channel.messages.fetch(messageId);
await interaction.reply({ content: 'Done!', ephemeral: true });
```

All of these calls are **automatically wrapped** with rate limit & network error handling by the monkey patch.

### How It Works

```typescript
// Before (what Discord.js sees internally):
client.rest.request(options) → Discord API → Response

// After patching (what happens now):
client.rest.request(options) 
  → Monkey Patch Wrapper
    → Try Discord API call
    → If 429: Wait retry_after seconds
    → Retry up to 3 times
    → Log details
  → Response
```

### `withRateLimitHandling()` (Legacy/Manual Option)

**Note:** This is no longer needed with the monkey patch but is kept for backward compatibility or special cases.

A wrapper function that manually handles rate limits:

```typescript
import { withRateLimitHandling } from './utils/rateLimitHandler';

// Manual wrapping (not needed anymore)
await withRateLimitHandling(
  () => channel.send({ content: 'Hello!' }),
  'send message to channel',
  3 // max retries (optional, default: 3)
);
```

### `batchWithRateLimit()`

Process multiple items with automatic delays between requests:

```typescript
import { batchWithRateLimit } from './utils/rateLimitHandler';

const results = await batchWithRateLimit(
  guildIds,
  async (guildId) => {
    return await client.guilds.fetch(guildId);
  },
  'fetch guilds',
  100 // delay between items in ms (default: 100ms)
);
```

### `logRateLimitInfo()`

**Note:** This function is provided for future use but is **not currently practical** with Discord.js because:
- Discord.js abstracts away raw HTTP response headers
- The library handles rate limiting internally
- You don't get direct access to rate limit headers in most operations

**Better Alternative:** Use the built-in rate limit monitoring (see "Monitoring Rate Limits" section below).

Monitor rate limit usage from response headers:

```typescript
import { logRateLimitInfo } from './utils/rateLimitHandler';

// After successful Discord API call (if you have access to headers)
logRateLimitInfo(response.headers, 'operation description');
```

This logs warnings when:
- Usage exceeds 80% of the rate limit
- Fewer than 5 requests remain

## Monitoring Rate Limits

Discord.js provides built-in events for monitoring rate limits in real-time:

```typescript
import { setupRateLimitMonitoring } from './utils/rateLimitMonitor';

// In your bot initialization
setupRateLimitMonitoring(client);
```

This will log whenever your bot hits a rate limit, including:
- Route that was rate limited
- HTTP method
- Time until reset
- Whether it's a global or per-route limit
- Request limit for that bucket

Example log output:
```
WARN: [ROUTE] Rate limit hit: POST /channels/:id/messages - waiting 1.50s (limit: 5)
WARN: [GLOBAL] Rate limit hit: * - waiting 2.00s (limit: 50)
```

## Where It's Used

The monkey patch is **applied globally** to all Discord API calls, including:

1. **Message Operations**
   - Sending messages
   - Editing messages
   - Deleting messages
   - Pinning/unpinning messages
   - Fetching messages

2. **Channel Operations**
   - Fetching channels
   - Creating channels
   - Modifying channels

3. **Interaction Responses**
   - Interaction replies
   - Interaction deferrals
   - Interaction edits
   - Follow-up messages

4. **Guild Operations**
   - Fetching guilds
   - Managing roles
   - Managing members

5. **Any Other Discord.js API Call**
   - The patch intercepts **all** REST API requests

No manual wrapping needed - it just works!

## Rate Limit Monitoring

The bot includes **real-time rate limit monitoring** using Discord.js's built-in events:

**Setup:** Automatically initialized in `index.ts` via `setupRateLimitMonitoring(client)`

**What it monitors:**
- Every time a rate limit is hit
- Which route/endpoint was affected
- How long until the rate limit resets
- Whether it's a global or per-route limit
- The limit value for that bucket

**Log Examples:**
```
WARN: [ROUTE] Rate limit hit: POST /channels/123456/messages - waiting 1.50s (limit: 5)
WARN: [GLOBAL] Rate limit hit: * - waiting 2.00s (limit: 50)
```

This gives you **real-time visibility** into rate limiting without needing to manually check headers.

## Best Practices

1. **Just use Discord.js normally** - the monkey patch handles everything
2. **Monitor logs** for rate limit warnings to identify bottlenecks
3. **Adjust concurrency** if you see frequent rate limits:
   - Reduce `MESSAGE_PROCESSING_WORKERS` (default: 5)
   - Add delays between batch operations
4. **Don't manually wrap** Discord.js calls (unless you need custom retry logic)
5. **Check logs regularly** to catch rate limit patterns early

## Rate Limit Types

### Per-Route Rate Limits
Most common. Each API endpoint has its own bucket (e.g., sending messages to a specific channel).

### Global Rate Limits
Less common. Applies across all requests from your bot. Usually 50 requests per second.

### Shared Rate Limits
Applied to resources that affect multiple bots (rare).

## Troubleshooting

### "This operation was aborted" or AbortError

**Cause:** Network timeout or connection interrupted during API call.

**Solutions:**
- Bot now automatically retries with exponential backoff (2s, 4s, 8s)
- Check server network stability
- Verify `MESSAGE_PROCESSING_WORKERS` is set to 1-2 for slow connections
- Check logs for retry patterns

### "Max retries exceeded for rate limit"

**Cause:** Your bot is making too many requests too quickly.

**Solutions:**
- Increase delay between batch operations
- Reduce concurrency in queue-based processing
- Check for infinite loops or excessive API calls
- Review MESSAGE_PROCESSING_WORKERS setting

### "Max retries exceeded for network error"

**Cause:** Persistent network issues preventing connection to Discord API.

**Solutions:**
- Check server internet connection stability
- Verify DNS resolution is working
- Check firewall/proxy settings
- Monitor network logs for packet loss
- Consider increasing timeout in Client config (default: 30s)

### Persistent rate limiting

**Cause:** Bot is under heavy load or misconfigured.

**Solutions:**
1. Check `MESSAGE_PROCESSING_WORKERS` env var (default: 5)
2. Reduce number of concurrent operations
3. Implement longer delays in batch processing
4. Consider caching frequently accessed data

## Configuration

Environment variables that affect rate limiting and network behavior:

- `MESSAGE_PROCESSING_WORKERS` - Number of concurrent message processors (default: 5)
  - Lower values = fewer concurrent API calls = less likely to hit rate limits/network issues
  - Higher values = faster processing = more likely to hit rate limits/network issues
  - **Recommended: 1-2 for slow/unstable connections**

Discord Client REST options (configured in `src/index.ts`):
- `rest.timeout` - Request timeout in milliseconds (default: 30000ms / 30s)
- `rest.retries` - Number of retries for failed requests (default: 3)

## Monitoring

Watch your logs for these patterns:

```
WARN: Rate limited (per-route). Retrying after 1.5s...
WARN: Network error detected. Retrying with exponential backoff...
WARN: High rate limit usage: 85.0% (3/20 remaining)
INFO: Low rate limit remaining: 2 requests left
ERROR: Max retries (3) exceeded for rate limit
ERROR: Max retries (3) exceeded for network error
```

## Further Reading

- [Discord API Rate Limits Documentation](https://discord.com/developers/docs/topics/rate-limits)
- [Discord.js Rate Limits Guide](https://discordjs.guide/popular-topics/rate-limits.html)
