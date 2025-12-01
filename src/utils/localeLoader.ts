import * as fs from "node:fs";
import * as path from "node:path";
import { logger } from "./logger";

/**
 * Locale code mapping from our file names to Discord locale codes
 * See: https://discord.com/developers/docs/reference#locales
 */
const LOCALE_MAP: Record<string, string> = {
  en: "en-US",
  es: "es-ES",
  ru: "ru",
  // Add more mappings as needed:
  // fr: "fr",
  // de: "de",
  // pt: "pt-BR",
};

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

    const discordLocale = LOCALE_MAP[localeName];
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

    const discordLocale = LOCALE_MAP[localeName];
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
