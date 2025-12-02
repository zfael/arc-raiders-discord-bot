import * as fs from "node:fs";
import * as path from "node:path";
import type { MapRotation } from "../types";
import { logger } from "./logger";

// Simple in-memory cache to avoid repeated disk reads during mass updates
// Key: "locale-hour"
// Only caches the current hour to minimize memory usage
const imageCache = new Map<string, Buffer>();
let cachedHour: number | null = null;

/**
 * Serves a pre-generated map image for the given rotation and locale.
 * Images are generated via `npm run generate-maps` and stored in `src/assets/generatedMaps`.
 */
export async function generateMapImage(
  currentRotation: MapRotation,
  locale: string = "en",
): Promise<Buffer> {
  const cacheKey = `${locale}-${currentRotation.hour}`;

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
    `../assets/generatedMaps/${locale}/${currentRotation.hour}.png`,
  );

  try {
    // Check if file exists first to provide a better error message
    await fs.promises.access(imagePath, fs.constants.F_OK);

    const buffer = await fs.promises.readFile(imagePath);

    // Cache the buffer for this hour
    imageCache.set(cacheKey, buffer);

    return buffer;
  } catch (error) {
    logger.error(
      { err: error, path: imagePath, locale, hour: currentRotation.hour },
      "Failed to load pre-generated map image",
    );

    // Fallback or re-throw?
    // Since we expect these to exist, throwing is appropriate to alert the admin.
    // The bot should probably not crash, but the command will fail.
    throw new Error(
      `Map image not found for locale "${locale}" and hour "${currentRotation.hour}". Please run "npm run generate-maps".`,
    );
  }
}
