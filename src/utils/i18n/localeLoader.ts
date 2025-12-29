import * as fs from "node:fs";
import * as path from "node:path";
import { logger } from "../logger";

const LOCALES_DIR = path.join(__dirname, "../../locales");
const MAP_ASSETS_DIR = path.join(__dirname, "../../assets/generatedMaps");

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
  "pt-br": { discordCode: "pt-BR" },
  fr: { discordCode: "fr" },
  de: { discordCode: "de" },
};

export const SUPPORTED_LOCALE_FILES: readonly string[] = Object.freeze(Object.keys(LOCALE_CONFIG));
const SUPPORTED_LOCALE_SET = new Set(SUPPORTED_LOCALE_FILES);

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
let cachedLocaleAssetDirs: string[] | null = null;
let healthCheckLogged = false;

function listLocaleFilesOnDisk(): string[] {
  if (!fs.existsSync(LOCALES_DIR)) {
    return [];
  }
  return fs
    .readdirSync(LOCALES_DIR)
    .filter((file) => file.endsWith(".json"))
    .map((file) => path.basename(file, ".json"));
}

function listAssetLocaleDirs(): string[] {
  if (!fs.existsSync(MAP_ASSETS_DIR)) {
    return [];
  }
  return fs.readdirSync(MAP_ASSETS_DIR).filter((entry) => {
    const dirPath = path.join(MAP_ASSETS_DIR, entry);
    try {
      return fs.statSync(dirPath).isDirectory();
    } catch {
      return false;
    }
  });
}

function logLocaleHealthWarnings(localeFilesOnDisk: string[], assetLocaleDirs: string[]): void {
  const missingLocaleFiles = SUPPORTED_LOCALE_FILES.filter(
    (locale) => !localeFilesOnDisk.includes(locale),
  );
  if (missingLocaleFiles.length > 0) {
    logger.warn(
      {
        missingLocales: missingLocaleFiles,
      },
      "Some locales defined in LOCALE_CONFIG are missing translation files. They will be skipped.",
    );
  }

  const extraLocaleFiles = localeFilesOnDisk.filter((locale) => !SUPPORTED_LOCALE_SET.has(locale));
  if (extraLocaleFiles.length > 0) {
    logger.warn(
      { extraLocales: extraLocaleFiles },
      "Found locale files on disk that are not defined in LOCALE_CONFIG. They will be ignored.",
    );
  }

  const missingAssetLocales = SUPPORTED_LOCALE_FILES.filter(
    (locale) => !assetLocaleDirs.includes(locale),
  );
  if (missingAssetLocales.length > 0) {
    logger.warn(
      { missingAssetLocales },
      "Locales are configured but missing generated map assets. Map images will fall back to English for these locales.",
    );
  }

  const extraAssetLocales = assetLocaleDirs.filter((locale) => !SUPPORTED_LOCALE_SET.has(locale));
  if (extraAssetLocales.length > 0) {
    logger.warn(
      { extraAssetLocales },
      "Found map asset directories without matching LOCALE_CONFIG entries. Consider removing them.",
    );
  }
}

function loadLocaleFromDisk(localeName: string): LocaleData | null {
  const filePath = path.join(LOCALES_DIR, `${localeName}.json`);
  if (!fs.existsSync(filePath)) {
    logger.warn(
      { locale: localeName, path: filePath },
      "Locale defined in LOCALE_CONFIG but translation file is missing on disk.",
    );
    return null;
  }

  try {
    const data = JSON.parse(fs.readFileSync(filePath, "utf-8")) as LocaleData;
    logger.info(`Loaded locale file: ${localeName}`);
    return data;
  } catch (error) {
    logger.error({ err: error }, `Failed to load locale file: ${localeName}`);
    return null;
  }
}

export function getLocalesWithMapAssets(): string[] {
  if (cachedLocaleAssetDirs) {
    return cachedLocaleAssetDirs;
  }
  const assetLocaleDirs = listAssetLocaleDirs();
  cachedLocaleAssetDirs = SUPPORTED_LOCALE_FILES.filter((locale) =>
    assetLocaleDirs.includes(locale),
  );
  return cachedLocaleAssetDirs;
}

/**
 * Scans the locales directory and loads all available locale files
 */
export function loadAvailableLocales(): Map<string, LocaleData> {
  if (cachedLocales) {
    return cachedLocales;
  }

  const locales = new Map<string, LocaleData>();
  const localeFilesOnDisk = listLocaleFilesOnDisk();
  const assetLocaleDirs = listAssetLocaleDirs();

  if (!healthCheckLogged) {
    logLocaleHealthWarnings(localeFilesOnDisk, assetLocaleDirs);
    healthCheckLogged = true;
  }

  for (const localeName of SUPPORTED_LOCALE_FILES) {
    const data = loadLocaleFromDisk(localeName);
    if (data) {
      locales.set(localeName, data);
    }
  }

  cachedLocales = locales;
  return locales;
}

export function isLocaleAvailable(locale: string): boolean {
  const normalized = locale?.toLowerCase();
  if (!normalized) return false;
  return loadAvailableLocales().has(normalized);
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
