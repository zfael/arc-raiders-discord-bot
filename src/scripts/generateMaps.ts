// @ts-nocheck
import * as fs from "node:fs";
import * as path from "node:path";
import puppeteer from "puppeteer";
import { CONDITION_EMOJIS, getAllRotations } from "../config/mapRotation";
import { i18nPromise, getT } from "../utils/i18n";
import { loadAvailableLocales } from "../utils/localeLoader";
import { logger } from "../utils/logger";
import type { MapRotation } from "../types";

// --- Constants & Config ---

const LOCATIONS = {
  buriedCity: {
    x: (418 / 2690) * 100,
    y: (750 / 1515) * 100,
    label: "Buried City",
  },
  spaceport: {
    x: (740 / 2690) * 100,
    y: (300 / 1515) * 100,
    label: "Spaceport",
  },
  stellaMontis: {
    x: (1992 / 2690) * 100,
    y: (192 / 1515) * 100,
    label: "Stella Montis",
  },
  blueGate: {
    x: (2000 / 2690) * 100,
    y: (620 / 1515) * 100,
    label: "Blue Gate",
  },
  dam: { x: (1420 / 2690) * 100, y: (876 / 1515) * 100, label: "Dam Battlegrounds" },
};

const ICON_MAPPING: { [key: string]: string } = {
  Harvester: "harvester.png",
  Night: "nightraid.png",
  Husks: "husks.png",
  Blooms: "lush.png",
  Storm: "electro.png",
  Caches: "cache.png",
  Probes: "probe.png",
  Tower: "spacetower_loot.png",
  Bunker: "bunker.png",
  Matriarch: "matriarch.png",
  Cold: "cold.png",
  Gate: "gate.png",
};

// --- Helper Functions ---

function loadIcons(): { [key: string]: string } {
  const icons: { [key: string]: string } = {};
  for (const [condition, filename] of Object.entries(ICON_MAPPING)) {
    try {
      const filePath = path.join(__dirname, "../assets", filename);
      if (fs.existsSync(filePath)) {
        const buffer = fs.readFileSync(filePath);
        icons[condition] = `data:image/png;base64,${buffer.toString("base64")}`;
      } else {
        logger.warn(`Icon file not found: ${filePath}`);
      }
    } catch (e) {
      logger.warn(`Failed to load icon for ${condition}: ${e}`);
    }
  }
  return icons;
}

// --- Main Generation Logic ---

async function generateAllMaps() {
  // 1. Await i18n initialization
  await i18nPromise;
  logger.info("i18n initialized.");

  // 2. Fetch rotations from database
  const rotations = await getAllRotations();
  logger.info(`Loaded ${rotations.length} rotations from database.`);

  const locales = Array.from(loadAvailableLocales().keys());
  const outputDir = path.join(__dirname, "../assets/generatedMaps");

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // 2. Prepare Assets
  const icons = loadIcons();
  const templatePath = path.join(__dirname, "../templates/map-status.html");
  const stylesPath = path.join(__dirname, "../templates/styles.css");
  const htmlContent = fs.readFileSync(templatePath, "utf-8");
  const cssContent = fs.readFileSync(stylesPath, "utf-8");
  const fullHtml = htmlContent.replace(
    '<link rel="stylesheet" href="styles.css">',
    `<style>${cssContent}</style>`,
  );

  const mapImagePath = path.join(__dirname, "../assets/map.png");
  const mapImageBuffer = fs.readFileSync(mapImagePath);
  const mapImageBase64 = `data:image/png;base64,${mapImageBuffer.toString("base64")}`;

  // 3. Launch Browser
  logger.info("Launching browser...");
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  await page.setViewport({
    width: 1240,
    height: 1200,
    deviceScaleFactor: 2,
  });

  // 4. Set Initial Content
  // We load the HTML once. Subsequent updates will be done via DOM manipulation.
  await page.setContent(fullHtml, { waitUntil: "load" });

  // Inject static assets into the page context once
  await page.evaluate(
    (mapImage, icons, locations, emojis) => {
      // @ts-expect-error
      window.STATIC_ASSETS = { mapImage, icons, locations, emojis };

      // Set map background immediately
      const mapImg = document.getElementById("map-bg") as HTMLImageElement;
      if (mapImg) mapImg.src = mapImage;
    },
    mapImageBase64,
    icons,
    LOCATIONS,
    CONDITION_EMOJIS,
  );

  logger.info(`Starting map generation for ${locales.length} locales...`);
  const startTime = Date.now();

  for (const locale of locales) {
    const localeDir = path.join(outputDir, locale);
    if (!fs.existsSync(localeDir)) {
      fs.mkdirSync(localeDir, { recursive: true });
    }

    logger.info(`Generating maps for locale: ${locale}`);
    const t = getT(locale);

    // Prepare translations
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

    for (let hour = 0; hour < 24; hour++) {
      const currentRotation = rotations[hour];
      const forecast: MapRotation[] = [];
      for (let i = 1; i <= 6; i++) {
        const hourIndex = (hour + i) % 24;
        forecast.push(rotations[hourIndex]);
      }

      const data = { current: currentRotation, forecast };

      // Update DOM
      await page.evaluate(
        (data, translations) => {
          // @ts-expect-error
          const { icons, locations, emojis } = window.STATIC_ASSETS;

          // Update forecast header
          const forecastText = document.getElementById("forecast-text");
          if (forecastText && translations.forecast_header) {
            forecastText.textContent = translations.forecast_header;
          }

          const getIconHtml = (condition: string) => {
            if (icons[condition]) {
              return `<img src="${icons[condition]}" class="condition-icon" alt="${condition}">`;
            }
            return emojis[condition] || "";
          };

          // Update Map Overlays
          const overlaysContainer = document.getElementById("map-overlays");
          if (overlaysContainer) {
            overlaysContainer.innerHTML = ""; // Clear previous
            Object.entries(locations).forEach(([key, loc]: [string, any]) => {
              const major = data.current[`${key}Major` as keyof typeof data.current];
              const minor = data.current[`${key}Minor` as keyof typeof data.current];
              const locLabel = translations[`location_${key}`] || loc.label;

              let statusHtml = "";
              if (major !== "None") {
                const majorTrans = translations[`event_${major.toLowerCase()}`] || major;
                statusHtml += `<div class="status-row status-major">${getIconHtml(major)} ${majorTrans}</div>`;
              }
              if (minor !== "None") {
                const minorTrans = translations[`event_${minor.toLowerCase()}`] || minor;
                statusHtml += `<div class="status-row status-minor">${getIconHtml(minor)} ${minorTrans}</div>`;
              }

              const marker = document.createElement("div");
              marker.className = "location-marker";
              marker.style.left = `${loc.x}%`;
              marker.style.top = `${loc.y}%`;

              if (major === "None" && minor === "None") {
                marker.innerHTML = `
                  <div class="location-name">${locLabel}</div>
                  <div class="location-pin"></div>
                `;
              } else {
                marker.innerHTML = `
                  <div class="location-name">${locLabel}</div>
                  <div class="location-pin"></div>
                  <div class="location-status">${statusHtml}</div>
                `;
              }
              overlaysContainer.appendChild(marker);
            });
          }

          // Update Forecast Grid
          const forecastGrid = document.getElementById("forecast-grid");
          if (forecastGrid) {
            forecastGrid.innerHTML = ""; // Clear previous
            data.forecast.forEach((rotation: any) => {
              const card = document.createElement("div");
              card.className = "forecast-card";

              let eventsHtml = "";
              const locs = ["dam", "buriedCity", "spaceport", "blueGate", "stellaMontis"];
              let hasEvents = false;

              locs.forEach((loc) => {
                const major = rotation[`${loc}Major`];
                if (major !== "None") {
                  hasEvents = true;
                  const locName =
                    translations[`location_${loc}`] || loc.charAt(0).toUpperCase() + loc.slice(1);
                  const eventName = translations[`event_${major.toLowerCase()}`] || major;
                  eventsHtml += `
                  <div class="event-row">
                    <span class="event-location">${locName}</span>
                    <span class="event-name">${getIconHtml(major)} ${eventName}</span>
                  </div>
                `;
                }
              });

              if (!hasEvents) {
                eventsHtml = `<div class="no-events">${translations.no_major_events}</div>`;
              }

              const hoursDiff =
                rotation.hour - data.current.hour > 0
                  ? rotation.hour - data.current.hour
                  : 24 + (rotation.hour - data.current.hour);
              const timeText = translations.in_hours.replace("{{hours}}", hoursDiff.toString());

              card.innerHTML = `
              <div class="forecast-header">
                <span class="forecast-time">${timeText}</span>
                <span class="forecast-label">${translations.upcoming}</span>
              </div>
              ${eventsHtml}
            `;
              forecastGrid.appendChild(card);
            });
          }
        },
        data,
        translations,
      );

      // Screenshot
      const element = await page.$(".container");
      if (element) {
        const filePath = path.join(localeDir, `${hour}.png`);
        await element.screenshot({ path: filePath, type: "png" });
      }
    }
    logger.info(`Completed ${locale}`);
  }

  await browser.close();
  const totalTime = Date.now() - startTime;
  logger.info(`All map images generated successfully in ${totalTime}ms.`);
  process.exit(0);
}

generateAllMaps().catch((error) => {
  logger.error({ err: error }, "Fatal error during map generation");
  process.exit(1);
});
