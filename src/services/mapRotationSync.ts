import type { Client, TextChannel } from "discord.js";
import type { MapRotation } from "../types";
import { logger } from "../utils/logger";
import { updateCacheIfChanged, type RotationChange } from "../utils/mapRotationCache";
import * as mapRotationRepo from "../repositories/mapRotationRepository";

const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/13TU1hf_Q-7kpp3oJeSze7dieaVARCJUd/export?format=csv&gid=1815524015";

// CSV column indices (0-based, after splitting by comma)
// Based on the sheet structure:
// C=UTC, G=Dam Minor, H=Dam Major, I=Buried City Minor, J=Buried City Major,
// K=Spaceport Minor, L=Spaceport Major, M=Blue Gate Minor, N=Blue Gate Major,
// O=Stella Montis Minor, P=Stella Montis Major
// But in CSV export, columns start from A, so we need to map accordingly
// Looking at the CSV output:
// Col 0: PST, Col 1: EST, Col 2: UTC, Col 3: IST, Col 4: CST, Col 5: UTC,
// Col 6: Dam Minor, Col 7: Dam Major, Col 8: Buried City Minor, Col 9: Buried City Major,
// Col 10: Spaceport Minor, Col 11: Spaceport Major, Col 12: Blue Gate Minor, Col 13: Blue Gate Major,
// Col 14: Stella Montis Minor, Col 15: Stella Montis Major
const COL_UTC = 2;
const COL_DAM_MINOR = 6;
const COL_DAM_MAJOR = 7;
const COL_BURIED_CITY_MINOR = 8;
const COL_BURIED_CITY_MAJOR = 9;
const COL_SPACEPORT_MINOR = 10;
const COL_SPACEPORT_MAJOR = 11;
const COL_BLUE_GATE_MINOR = 12;
const COL_BLUE_GATE_MAJOR = 13;
const COL_STELLA_MONTIS_MINOR = 14;
const COL_STELLA_MONTIS_MAJOR = 15;

function parseHour(utcValue: string): number | null {
  // Format: "00:00", "01:00", etc.
  const match = utcValue.match(/^(\d{1,2}):\d{2}$/);
  if (!match) return null;
  const hour = Number.parseInt(match[1], 10);
  return hour >= 0 && hour < 24 ? hour : null;
}

function normalizeCondition(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === "none") {
    return "None";
  }
  // Capitalize first letter
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function parseCSV(csvText: string): string[][] {
  const lines = csvText.split("\n");
  return lines.map((line) => {
    // Simple CSV parsing - handles basic cases
    // For more complex CSV with quoted fields, would need a proper parser
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        result.push(current);
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  });
}

export async function fetchSheetData(): Promise<string> {
  const response = await fetch(SHEET_CSV_URL);

  if (!response.ok) {
    throw new Error(`Failed to fetch sheet: ${response.status} ${response.statusText}`);
  }

  return response.text();
}

export function parseSheetToRotations(csvText: string): MapRotation[] {
  const rows = parseCSV(csvText);
  const rotations: MapRotation[] = [];

  // Skip header rows (first 2 rows based on the sheet structure)
  for (let i = 2; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 16) continue;

    const hour = parseHour(row[COL_UTC]);
    if (hour === null) continue;

    rotations.push({
      hour,
      damMinor: normalizeCondition(row[COL_DAM_MINOR]),
      damMajor: normalizeCondition(row[COL_DAM_MAJOR]),
      buriedCityMinor: normalizeCondition(row[COL_BURIED_CITY_MINOR]),
      buriedCityMajor: normalizeCondition(row[COL_BURIED_CITY_MAJOR]),
      spaceportMinor: normalizeCondition(row[COL_SPACEPORT_MINOR]),
      spaceportMajor: normalizeCondition(row[COL_SPACEPORT_MAJOR]),
      blueGateMinor: normalizeCondition(row[COL_BLUE_GATE_MINOR]),
      blueGateMajor: normalizeCondition(row[COL_BLUE_GATE_MAJOR]),
      stellaMontisMinor: normalizeCondition(row[COL_STELLA_MONTIS_MINOR]),
      stellaMontisMajor: normalizeCondition(row[COL_STELLA_MONTIS_MAJOR]),
    });
  }

  return rotations;
}

export async function syncMapRotations(client?: Client): Promise<{
  success: boolean;
  updated: boolean;
  error?: string;
}> {
  logger.info("Starting map rotation sync from Google Sheets");

  try {
    // Fetch CSV from Google Sheets
    const csvText = await fetchSheetData();

    // Parse to rotations
    const rotations = parseSheetToRotations(csvText);

    if (rotations.length !== 24) {
      throw new Error(`Expected 24 rotations, got ${rotations.length}`);
    }

    // Update cache/database if changed
    const { updated, changes } = await updateCacheIfChanged(rotations);

    await mapRotationRepo.setLastSyncStatus(updated ? "updated" : "unchanged");

    logger.info(
      updated
        ? "Map rotations synced and updated successfully"
        : "Map rotations synced, no changes detected",
    );

    // Send Discord notification if there are changes and client is available
    if (updated && changes.length > 0 && client) {
      await sendSyncUpdateNotification(client, changes);
    }

    return { success: true, updated };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logger.error({ err: error }, "Failed to sync map rotations");

    await mapRotationRepo.setLastSyncStatus(`error: ${errorMessage}`).catch(() => {});

    // Send alert to Discord if client is available
    if (client) {
      await sendSyncErrorAlert(client, errorMessage);
    }

    return { success: false, updated: false, error: errorMessage };
  }
}

async function sendSyncErrorAlert(client: Client, errorMessage: string): Promise<void> {
  try {
    // Import here to avoid circular dependency
    const { getServerConfigs } = await import("../utils/serverConfig");
    const configs = await getServerConfigs();

    // Send to first configured channel (could be improved to use a dedicated admin channel)
    const firstGuildId = Object.keys(configs)[0];
    if (!firstGuildId) return;

    const channelId = configs[firstGuildId].channelId;
    const channel = await client.channels.fetch(channelId);

    if (channel && "send" in channel) {
      await (channel as TextChannel).send({
        content: `⚠️ **Map Rotation Sync Error**\n\`\`\`${errorMessage}\`\`\``,
      });
    }
  } catch (alertError) {
    logger.error({ err: alertError }, "Failed to send sync error alert");
  }
}

function formatFieldName(field: string): string {
  // Convert camelCase to readable format: damMajor -> Dam Major
  const fieldMap: Record<string, string> = {
    damMinor: "Dam Minor",
    damMajor: "Dam Major",
    buriedCityMinor: "Buried City Minor",
    buriedCityMajor: "Buried City Major",
    spaceportMinor: "Spaceport Minor",
    spaceportMajor: "Spaceport Major",
    blueGateMinor: "Blue Gate Minor",
    blueGateMajor: "Blue Gate Major",
    stellaMontisMinor: "Stella Montis Minor",
    stellaMontisMajor: "Stella Montis Major",
  };
  return fieldMap[field] || field;
}

async function sendSyncUpdateNotification(
  client: Client,
  changes: RotationChange[],
): Promise<void> {
  try {
    const { getServerConfigs } = await import("../utils/serverConfig");
    const configs = await getServerConfigs();

    // Group changes by hour for better readability
    const changesByHour = new Map<number, RotationChange[]>();
    for (const change of changes) {
      const hourChanges = changesByHour.get(change.hour) || [];
      hourChanges.push(change);
      changesByHour.set(change.hour, hourChanges);
    }

    // Build the notification message
    let message = `🔄 **Map Rotation Updated**\n${changes.length} change(s) detected:\n\n`;

    for (const [hour, hourChanges] of changesByHour) {
      message += `**Hour ${hour.toString().padStart(2, "0")}:00 UTC**\n`;
      for (const change of hourChanges) {
        message += `• ${formatFieldName(change.field)}: ${change.oldValue} → ${change.newValue}\n`;
      }
      message += "\n";
    }

    // Truncate if too long for Discord (2000 char limit)
    if (message.length > 1900) {
      message = `${message.substring(0, 1900)}\n... and more changes`;
    }

    // Send to all configured channels
    for (const [guildId, config] of Object.entries(configs)) {
      if (!config?.channelId) continue;

      try {
        const channel = await client.channels.fetch(config.channelId);
        if (channel && "send" in channel) {
          await (channel as TextChannel).send({ content: message });
          logger.debug({ guildId, channelId: config.channelId }, "Sent sync update notification");
        }
      } catch (err) {
        logger.warn(
          { err, guildId, channelId: config.channelId },
          "Failed to send update notification to channel",
        );
      }
    }

    logger.info(`Sent map rotation update notification to ${Object.keys(configs).length} servers`);
  } catch (alertError) {
    logger.error({ err: alertError }, "Failed to send sync update notification");
  }
}
