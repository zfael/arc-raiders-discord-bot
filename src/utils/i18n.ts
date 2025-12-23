import i18next from "i18next";
import Backend from "i18next-fs-backend";
import * as fs from "node:fs";
import * as path from "node:path";

import { DISCORD_TO_FILE_LOCALE, loadAvailableLocales } from "./localeLoader";
import { logger } from "./logger";

const i18n = i18next.createInstance();

const availableLocales = Array.from(loadAvailableLocales().keys());

// Track initialization state
let isInitialized = false;

export const i18nPromise = i18n
  .use(Backend)
  .init({
    lng: "en", // Default language
    fallbackLng: "en",
    supportedLngs: availableLocales, // Explicitly tell i18next which locales to support (including hyphens like pt-br)
    preload: availableLocales,
    lowerCaseLng: true, // Ensure i18next keeps locale keys lowercase (matches our filenames)
    load: "currentOnly", // Avoid loading fallback variants like pt or pt-br vs pt-BR
    ns: ["translation"],
    defaultNS: "translation",
    backend: {
      loadPath: path.join(__dirname, "../locales/{{lng}}.json"),
      // Add parse function to handle JSON files correctly
      parse: (data: string, path: string) => {
        try {
          return JSON.parse(data);
        } catch (e) {
          logger.error({ err: e, path }, `Failed to parse locale file: ${path}`);
          return {};
        }
      },
    },
    interpolation: {
      escapeValue: false, // Discord handles escaping
    },
    // Ensure resources are loaded synchronously
    initImmediate: false,
  })
  .then(async () => {
    // Explicitly load all locale resources after initialization
    // This ensures files with hyphens (like pt-br) are properly loaded
    const localesPath = path.join(__dirname, "../locales");
    for (const locale of availableLocales) {
      if (!i18n.hasResourceBundle(locale, "translation")) {
        logger.warn(
          `Resource bundle not loaded for locale: ${locale}, attempting to manually load...`,
        );
        try {
          const filePath = path.join(localesPath, `${locale}.json`);
          if (fs.existsSync(filePath)) {
            const fileContent = fs.readFileSync(filePath, "utf-8");
            const translations = JSON.parse(fileContent);
            i18n.addResourceBundle(locale, "translation", translations, true, true);
            logger.info(`Manually loaded resource bundle for locale: ${locale}`);
          } else {
            logger.error(`Locale file not found: ${filePath}`);
          }
        } catch (err) {
          logger.error({ err }, `Failed to manually load resources for locale: ${locale}`);
        }
      }
    }
    logger.info(`i18next initialized. Loaded languages: ${i18n.languages.join(", ")}`);
    isInitialized = true;
    return i18n;
  });

export default i18n;

/**
 * Returns true if i18n has been fully initialized.
 */
export const isI18nReady = (): boolean => isInitialized;

/**
 * Helper to get a fixed T function for a specific locale.
 * @param locale The locale to use (e.g., 'en', 'es', 'pt-BR', 'pt-br').
 * @returns A translation function.
 */
export const getT = (locale: string) => {
  if (!isInitialized) {
    logger.warn(
      { locale },
      "getT called before i18n initialization complete - translations may be missing",
    );
  }

  if (!locale || typeof locale !== "string") {
    return i18n.getFixedT("en", "translation");
  }

  let resolvedLocale: string | null = null;

  // First check if it's already a valid file name (e.g., 'pt-br', 'en', 'es')
  const normalizedLocale = locale.toLowerCase();
  if (availableLocales.includes(normalizedLocale)) {
    resolvedLocale = normalizedLocale;
  }
  // Try exact match from Discord locale mapping (e.g., 'pt-BR' -> 'pt-br')
  else if (DISCORD_TO_FILE_LOCALE[locale]) {
    const mappedLocale = DISCORD_TO_FILE_LOCALE[locale];
    if (availableLocales.includes(mappedLocale)) {
      resolvedLocale = mappedLocale;
    }
  }
  // Try Discord mapping with normalized (lowercase) version
  else if (DISCORD_TO_FILE_LOCALE[normalizedLocale]) {
    const mappedLocale = DISCORD_TO_FILE_LOCALE[normalizedLocale];
    if (availableLocales.includes(mappedLocale)) {
      resolvedLocale = mappedLocale;
    }
  }
  // Fallback: try just the language code (e.g., 'es-ES' -> 'es', 'pt-BR' -> 'pt')
  else {
    const langCode = locale.split("-")[0].toLowerCase();
    if (availableLocales.includes(langCode)) {
      resolvedLocale = langCode;
    }
  }

  // Default to English if no locale resolved
  if (!resolvedLocale) {
    resolvedLocale = "en";
  }

  // Explicitly specify the namespace to ensure proper loading
  // Use getFixedT with the resolved locale - this should work now that resources are loaded
  const t = i18n.getFixedT(resolvedLocale, "translation");

  // If the resource bundle exists but we're still getting English, try accessing directly
  if (resolvedLocale !== "en" && i18n.hasResourceBundle(resolvedLocale, "translation")) {
    // Create a custom T function that uses the resource bundle directly
    const bundle = i18n.getResourceBundle(resolvedLocale, "translation");
    if (bundle) {
      return (key: string, options?: any): string => {
        // Try to get from the bundle first
        const keys = key.split(".");
        let value: any = bundle;
        for (const k of keys) {
          if (value && typeof value === "object" && k in value) {
            value = value[k];
          } else {
            // Fall back to i18next's translation
            const result = t(key, options);
            return typeof result === "string" ? result : String(result || key);
          }
        }
        if (typeof value === "string") {
          // Handle interpolation
          if (options && value.includes("{{")) {
            return value.replace(/\{\{(\w+)\}\}/g, (match, key) => {
              return options[key] !== undefined ? String(options[key]) : match;
            });
          }
          return value;
        }
        // Fall back to i18next if we can't find it
        const result = t(key, options);
        return typeof result === "string" ? result : String(result || key);
      };
    }
  }

  // Wrap the i18next T function to ensure it always returns a string
  return (key: string, options?: any): string => {
    const result = t(key, options);
    return typeof result === "string" ? result : String(result || key);
  };
};

/**
 * Helper to translate event names (basic mapping)
 * @param t The translation function
 * @param event The event name to translate
 */
export const translateEvent = (t: (key: string, options?: any) => string, event: string) => {
  if (event === "None") return t("map_rotation.events.none");
  const key = event.toLowerCase();
  return t(`map_rotation.events.${key}`, { defaultValue: event });
};
