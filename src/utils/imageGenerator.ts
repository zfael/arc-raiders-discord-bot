import { MAP_ROTATIONS } from "../config/mapRotation";
import type { MapRotation } from "../types";
import { HtmlRenderer } from "./htmlRenderer";
import { getT } from "./i18n";
import { logger } from "./logger";

const renderer = new HtmlRenderer();

// Cache key: "hour-locale"
const imageCache = new Map<string, Buffer>();

export async function generateMapImage(
  currentRotation: MapRotation,
  locale: string = "en",
): Promise<Buffer> {
  const cacheKey = `${currentRotation.hour}-${locale}`;

  // Return cached image if available
  if (imageCache.has(cacheKey)) {
    return imageCache.get(cacheKey)!;
  }

  try {
    const forecast: MapRotation[] = [];
    const currentHour = currentRotation.hour;
    for (let i = 1; i <= 6; i++) {
      const hourIndex = (currentHour + i) % 24;
      forecast.push(MAP_ROTATIONS[hourIndex]);
    }

    const t = getT(locale);
    const translations: Record<string, string> = {
      forecast_header: t("image_renderer.forecast_header"),
      location_dam: t("map_rotation.locations.dam"),
      location_buriedCity: t("map_rotation.locations.buried_city"),
      location_spaceport: t("map_rotation.locations.spaceport"),
      location_blueGate: t("map_rotation.locations.blue_gate"),
      location_stellaMontis: t("map_rotation.locations.stella_montis"),
      event_harvester: t("map_rotation.events.harvester"),
      event_night: t("map_rotation.events.night"),
      event_storm: t("map_rotation.events.storm"),
      event_tower: t("map_rotation.events.tower"),
      event_bunker: t("map_rotation.events.bunker"),
      event_matriarch: t("map_rotation.events.matriarch"),
      event_husks: t("map_rotation.events.husks"),
      event_blooms: t("map_rotation.events.blooms"),
      event_caches: t("map_rotation.events.caches"),
      event_probes: t("map_rotation.events.probes"),
      no_major_events: t("map_rotation.forecast.no_major_events"),
      upcoming: t("map_rotation.forecast.upcoming"),
      in_hours: t("map_rotation.forecast.in_hours"),
    };

    const buffer = await renderer.render(
      {
        current: currentRotation,
        forecast: forecast,
      },
      translations,
    );

    // Update cache
    // Clear old cache for different hours to prevent memory leak (simple strategy)
    for (const key of imageCache.keys()) {
      if (!key.startsWith(`${currentRotation.hour}-`)) {
        imageCache.delete(key);
      }
    }
    imageCache.set(cacheKey, buffer);

    return buffer;
  } catch (error) {
    logger.error({ err: error }, "Error generating map image");
    throw error;
  }
}
