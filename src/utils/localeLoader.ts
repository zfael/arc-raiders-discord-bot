import * as fs from "node:fs";
import * as path from "node:path";
import { logger } from "./logger";

/**
 * Locale configuration - single source of truth for all locale mappings.
 * See Discord locale codes: https://discord.com/developers/docs/reference#locales
 *
 * Each entry maps our file name to:
 * - discordCode: The primary Discord locale code (used for command registration)
 * - aliases: Additional Discord locale codes that should use this file (optional)
 *
 * To add a new language:
 * 1. Create the locale file (e.g., src/locales/fr.json)
 * 2. Add an entry here with the Discord locale code
 * 3. Run `npm run deploy-commands` to register localized commands
 */
interface LocaleConfig {
  discordCode: string;
  aliases?: string[];
}

const LOCALE_CONFIG: Record<string, LocaleConfig> = {
  en: { discordCode: "en-US", aliases: ["en-GB"] },
  es: { discordCode: "es-ES", aliases: ["es-419"] }, // es-419 = Latin American Spanish
  ru: { discordCode: "ru" },
  "pt-br": { discordCode: "pt-BR" },
  // Add more locales as needed:
  // fr: { discordCode: "fr" },
  // de: { discordCode: "de" },
};

/**
 * Maps our file names to Discord locale codes (for command registration)
 * e.g., "pt-br" -> "pt-BR"
 */
export const FILE_TO_DISCORD_LOCALE: Record<string, string> = Object.fromEntries(
  Object.entries(LOCALE_CONFIG).map(([file, config]) => [file, config.discordCode]),
);

/**
 * Maps Discord locale codes to our file names (for runtime translations)
 * e.g., "pt-BR" -> "pt-br", "es-419" -> "es"
 */
export const DISCORD_TO_FILE_LOCALE: Record<string, string> = Object.fromEntries(
  Object.entries(LOCALE_CONFIG).flatMap(([file, config]) => [
    [config.discordCode, file],
    ...(config.aliases?.map((alias) => [alias, file]) ?? []),
  ]),
);

interface CommandMetadata {
  name: string;
  description: string;
  options?: Record<
    string,
    {
      name: string;
      description: string;
    }
  >;
}

interface LocaleData {
  _language_name?: string;
  command_metadata?: Record<string, CommandMetadata>;
}

let cachedLocales: Map<string, LocaleData> | null = null;

/**
 * Scans the locales directory and loads all available locale files
 */
export function loadAvailableLocales(): Map<string, LocaleData> {
  if (cachedLocales) {
    return cachedLocales;
  }

  const localesPath = path.join(__dirname, "../locales");
  const localeFiles = fs.readdirSync(localesPath).filter((file) => file.endsWith(".json"));

  const locales = new Map<string, LocaleData>();

  for (const file of localeFiles) {
    const localeName = path.basename(file, ".json");
    const filePath = path.join(localesPath, file);

    try {
      const data = JSON.parse(fs.readFileSync(filePath, "utf-8")) as LocaleData;
      locales.set(localeName, data);
      logger.info(`Loaded locale file: ${localeName}`);
    } catch (error) {
      logger.error({ err: error }, `Failed to load locale file: ${file}`);
    }
  }

  cachedLocales = locales;
  return locales;
}

/**
 * Builds localization objects for command names and descriptions
 */
export function buildCommandLocalizations(
  commandName: string,
  locales: Map<string, LocaleData>,
): {
  nameLocalizations: Record<string, string>;
  descriptionLocalizations: Record<string, string>;
} {
  const nameLocalizations: Record<string, string> = {};
  const descriptionLocalizations: Record<string, string> = {};

  for (const [localeName, localeData] of locales.entries()) {
    // Skip English as it's the default
    if (localeName === "en") continue;

    const discordLocale = FILE_TO_DISCORD_LOCALE[localeName];
    if (!discordLocale) {
      logger.warn(`No Discord locale mapping found for: ${localeName}`);
      continue;
    }

    const metadata = localeData.command_metadata?.[commandName];
    if (!metadata) {
      logger.warn(
        `No command_metadata found for command "${commandName}" in locale "${localeName}"`,
      );
      continue;
    }

    try {
      nameLocalizations[discordLocale] = metadata.name;
      descriptionLocalizations[discordLocale] = metadata.description;
    } catch (error) {
      logger.error(
        { err: error },
        `Failed to apply localizations for command "${commandName}" in locale "${localeName}"`,
      );
    }
  }

  return { nameLocalizations, descriptionLocalizations };
}

/**
 * Builds localization objects for command option names and descriptions
 */
export function buildOptionLocalizations(
  commandName: string,
  optionName: string,
  locales: Map<string, LocaleData>,
): {
  nameLocalizations: Record<string, string>;
  descriptionLocalizations: Record<string, string>;
} {
  const nameLocalizations: Record<string, string> = {};
  const descriptionLocalizations: Record<string, string> = {};

  for (const [localeName, localeData] of locales.entries()) {
    // Skip English as it's the default
    if (localeName === "en") continue;

    const discordLocale = FILE_TO_DISCORD_LOCALE[localeName];
    if (!discordLocale) continue;

    const metadata = localeData.command_metadata?.[commandName];
    const optionMetadata = metadata?.options?.[optionName];

    if (!optionMetadata) {
      logger.warn(
        `No option metadata found for "${commandName}.${optionName}" in locale "${localeName}"`,
      );
      continue;
    }

    try {
      nameLocalizations[discordLocale] = optionMetadata.name;
      descriptionLocalizations[discordLocale] = optionMetadata.description;
    } catch (error) {
      logger.error(
        { err: error },
        `Failed to apply option localizations for "${commandName}.${optionName}" in locale "${localeName}"`,
      );
    }
  }

  return { nameLocalizations, descriptionLocalizations };
}
