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

/**
 * Sends notification when map rotations are updated from sheet sync
 */
export async function notifyMapRotationUpdated(
  changes: { hour: number; field: string; oldValue: string; newValue: string }[],
): Promise<void> {
  // Group changes by hour
  const changesByHour = new Map<number, typeof changes>();
  for (const change of changes) {
    const hourChanges = changesByHour.get(change.hour) || [];
    hourChanges.push(change);
    changesByHour.set(change.hour, hourChanges);
  }

  // Build description
  let description = "";
  for (const [hour, hourChanges] of changesByHour) {
    description += `**Hour ${hour.toString().padStart(2, "0")}:00 UTC**\n`;
    for (const change of hourChanges) {
      description += `• ${change.field}: ${change.oldValue} → ${change.newValue}\n`;
    }
    description += "\n";
  }

  // Truncate if too long
  if (description.length > 4000) {
    description = `${description.substring(0, 3950)}\n... and more changes`;
  }

  const embed: WebhookEmbed = {
    title: "🔄 Map Rotation Updated",
    description: `${changes.length} change(s) detected:\n\n${description}`,
    color: 0x5865f2, // Discord blurple
    timestamp: new Date().toISOString(),
  };

  await sendWebhook([embed]);
}

/**
 * Sends notification when user feedback is received
 */
export async function notifyFeedbackReceived(
  feedbackType: string,
  guildId: string,
  message: string,
): Promise<void> {
  const typeEmojis: Record<string, string> = {
    bug: "🐛",
    suggestion: "💡",
    general: "💬",
  };

  const typeLabels: Record<string, string> = {
    bug: "Bug Report",
    suggestion: "Suggestion",
    general: "General Feedback",
  };

  // Truncate message if too long
  const truncatedMessage = message.length > 1000 ? `${message.substring(0, 997)}...` : message;

  const embed: WebhookEmbed = {
    title: `📬 New Feedback: ${typeEmojis[feedbackType] || "📝"} ${typeLabels[feedbackType] || feedbackType}`,
    color: feedbackType === "bug" ? 0xed4245 : feedbackType === "suggestion" ? 0x57f287 : 0x5865f2,
    fields: [
      { name: "Type", value: typeLabels[feedbackType] || feedbackType, inline: true },
      { name: "Guild ID", value: guildId, inline: true },
      { name: "Message", value: truncatedMessage },
    ],
    timestamp: new Date().toISOString(),
  };

  await sendWebhook([embed]);
}
