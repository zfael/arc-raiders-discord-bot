import { logger } from "./logger";

const WEBHOOK_URL = process.env.DISCORD_OBSERVABILITY_WEBHOOK_URL;

interface WebhookEmbed {
  title: string;
  description?: string;
  color: number;
  fields?: { name: string; value: string; inline?: boolean }[];
  timestamp?: string;
}

/**
 * Sends a message to the observability webhook
 */
async function sendWebhook(embeds: WebhookEmbed[]): Promise<void> {
  if (!WEBHOOK_URL) {
    logger.debug("Observability webhook URL not configured, skipping notification");
    return;
  }

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ embeds }),
    });

    if (!response.ok) {
      logger.warn({ status: response.status }, "Failed to send observability webhook");
    }
  } catch (error) {
    logger.error({ err: error }, "Error sending observability webhook");
  }
}

/**
 * Sends notification when bot joins a server
 */
export async function notifyBotJoined(
  serverName: string,
  serverId: string,
  totalServers: number,
  memberCount: number,
): Promise<void> {
  const embed: WebhookEmbed = {
    title: "✅ Bot Added to Server",
    color: 0x57f287, // Green
    fields: [
      { name: "Server", value: serverName, inline: true },
      { name: "ID", value: serverId, inline: true },
      { name: "Members", value: String(memberCount), inline: true },
      { name: "Total Servers", value: String(totalServers), inline: true },
    ],
    timestamp: new Date().toISOString(),
  };

  await sendWebhook([embed]);
}

/**
 * Sends notification when bot is removed from a server
 */
export async function notifyBotRemoved(
  serverName: string,
  serverId: string,
  totalServers: number,
): Promise<void> {
  const fields = [
    { name: "Server", value: serverName, inline: true },
    { name: "ID", value: serverId, inline: true },
    { name: "Total Servers", value: String(totalServers), inline: true },
  ];

  const embed: WebhookEmbed = {
    title: "❌ Bot Removed from Server",
    color: 0xed4245, // Red
    fields,
    timestamp: new Date().toISOString(),
  };

  await sendWebhook([embed]);
}
