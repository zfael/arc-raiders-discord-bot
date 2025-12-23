import * as fs from "node:fs";
import * as path from "node:path";
import type { MapRotation } from "../types";
import { DISCORD_TO_FILE_LOCALE, getLocalesWithMapAssets } from "./i18n/localeLoader";
import { logger } from "./logger";

// Simple in-memory cache to avoid repeated disk reads during mass updates
// Key: "locale-hour"
// Only caches the current hour to minimize memory usage
const imageCache = new Map<string, Buffer>();
let cachedHour: number | null = null;

const AVAILABLE_IMAGE_LOCALES = new Set(getLocalesWithMapAssets());
if (!AVAILABLE_IMAGE_LOCALES.has("en")) {
  AVAILABLE_IMAGE_LOCALES.add("en");
}

/**
 * Resolves a locale to a valid image locale folder name.
 * Normalizes Discord locales (e.g., "pt-BR" -> "pt-br") and falls back to "en" if not available.
 */
function hasImageLocale(locale: string | undefined): boolean {
  return !!locale && AVAILABLE_IMAGE_LOCALES.has(locale);
}

export function resolveImageLocale(locale: string): string {
  if (!locale || typeof locale !== "string") {
    return "en";
  }

  // Normalize to lowercase
  const normalizedLocale = locale.toLowerCase();

  // Check if it's directly available
  if (hasImageLocale(normalizedLocale)) {
    return normalizedLocale;
  }

  // Try Discord locale mapping (e.g., "pt-BR" -> "pt-br")
  const mappedLocale = DISCORD_TO_FILE_LOCALE[locale];
  if (hasImageLocale(mappedLocale)) {
    return mappedLocale;
  }

  // Try with normalized version of Discord mapping
  const normalizedMapped = DISCORD_TO_FILE_LOCALE[normalizedLocale];
  if (hasImageLocale(normalizedMapped)) {
    return normalizedMapped;
  }

  // Try just the language code (e.g., "es-ES" -> "es")
  const langCode = locale.split("-")[0].toLowerCase();
  if (hasImageLocale(langCode)) {
    return langCode;
  }

  // Default to English if available, otherwise try first known locale
  if (hasImageLocale("en")) {
    return "en";
  }
  const iterator = AVAILABLE_IMAGE_LOCALES.values().next();
  return iterator.done ? "en" : iterator.value;
}

/**
 * Loads a pre-generated map image for the given rotation and locale.
 * Images are generated via `npm run generate-maps` and stored in `src/assets/generatedMaps`.
 */
export async function loadMapImage(
  currentRotation: MapRotation,
  locale: string = "en",
): Promise<Buffer> {
  // Resolve the locale to a valid image folder
  const resolvedLocale = resolveImageLocale(locale);
  const cacheKey = `${resolvedLocale}-${currentRotation.hour}`;

  // If hour changed, clear the cache (only keep current hour's images)
  if (cachedHour !== null && cachedHour !== currentRotation.hour) {
    imageCache.clear();
    logger.info(`Cache cleared for hour change (${cachedHour} -> ${currentRotation.hour})`);
  }
  cachedHour = currentRotation.hour;

  // Return cached image if available
  if (imageCache.has(cacheKey)) {
    return imageCache.get(cacheKey)!;
  }

  // Construct path to the pre-generated image
  // Format: src/assets/generatedMaps/<locale>/<hour>.png
  const imagePath = path.join(
    __dirname,
    `../assets/generatedMaps/${resolvedLocale}/${currentRotation.hour}.png`,
  );

  try {
    // Check if file exists first to provide a better error message
    await fs.promises.access(imagePath, fs.constants.F_OK);

    const buffer = await fs.promises.readFile(imagePath);

    // Cache the buffer for this hour
    imageCache.set(cacheKey, buffer);

    return buffer;
  } catch (error) {
    // If resolved locale fails, try falling back to English
    if (resolvedLocale !== "en") {
      logger.warn(
        { locale, resolvedLocale, hour: currentRotation.hour },
        `Image not found for locale "${resolvedLocale}", falling back to "en"`,
      );
      const fallbackPath = path.join(
        __dirname,
        `../assets/generatedMaps/en/${currentRotation.hour}.png`,
      );
      try {
        const buffer = await fs.promises.readFile(fallbackPath);
        imageCache.set(cacheKey, buffer);
        return buffer;
      } catch (_fallbackError) {
        // English fallback also failed
      }
    }

    logger.error(
      { err: error, path: imagePath, locale, resolvedLocale, hour: currentRotation.hour },
      "Failed to load pre-generated map image",
    );

    throw new Error(
      `Map image not found for locale "${resolvedLocale}" and hour "${currentRotation.hour}". Please run "npm run generate-maps".`,
    );
  }
}
