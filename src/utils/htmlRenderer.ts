// @ts-nocheck

import * as fs from "node:fs";
import * as path from "node:path";
import puppeteer, { type Browser, type Page } from "puppeteer";
import { CONDITION_EMOJIS } from "../config/mapRotation";
import type { MapRotation } from "../types";
import { logger } from "./logger";

// Map coordinates (percentage based on 2690x1515 image)
// x: percentage from left, y: percentage from top
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
  dam: { x: (1420 / 2690) * 100, y: (876 / 1515) * 100, label: "Dam" },
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

interface RenderData {
  current: MapRotation;
  forecast: MapRotation[];
}

export class HtmlRenderer {
  private templatePath: string;
  private stylesPath: string;
  private icons: { [key: string]: string };

  constructor() {
    this.templatePath = path.join(__dirname, "../templates/map-status.html");
    this.stylesPath = path.join(__dirname, "../templates/styles.css");
    this.icons = this.loadIcons();
  }

  private loadIcons(): { [key: string]: string } {
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

  private browserPromise: Promise<Browser> | null = null;

  private getBrowser(): Promise<Browser> {
    if (!this.browserPromise) {
      this.browserPromise = puppeteer
        .launch({
          headless: true,
          args: ["--no-sandbox", "--disable-setuid-sandbox"],
        })
        .then((browser) => {
          // Handle browser disconnect/crash
          browser.on("disconnected", () => {
            this.browserPromise = null;
          });
          return browser;
        });
    }
    return this.browserPromise;
  }

  async render(data: RenderData, translations: Record<string, string>): Promise<Buffer> {
    let page: Page | undefined;
    try {
      const browser = await this.getBrowser();
      page = await browser.newPage();

      await page.setViewport({
        width: 1240,
        height: 1200,
        deviceScaleFactor: 2,
      });

      const htmlContent = fs.readFileSync(this.templatePath, "utf-8");
      const cssContent = fs.readFileSync(this.stylesPath, "utf-8");

      const fullHtml = htmlContent.replace(
        '<link rel="stylesheet" href="styles.css">',
        `<style>${cssContent}</style>`,
      );

      await page.setContent(fullHtml, { waitUntil: "networkidle0" });

      const mapImagePath = path.join(__dirname, "../assets/map.png");
      const mapImageBuffer = fs.readFileSync(mapImagePath);
      const mapImageBase64 = `data:image/png;base64,${mapImageBuffer.toString("base64")}`;
      await page.evaluate(
        (data, locations, emojis, icons, mapImage, translations) => {
          const mapImg = document.getElementById("map-bg");
          if (mapImg) mapImg.src = mapImage;

          // Update forecast header with translation
          const forecastText = document.getElementById("forecast-text");
          if (forecastText && translations.forecast_header) {
            forecastText.textContent = translations.forecast_header;
          }

          const getIconHtml = (condition) => {
            if (icons[condition]) {
              return `<img src="${icons[condition]}" class="condition-icon" alt="${condition}">`;
            }
            return emojis[condition] || "";
          };

          const overlaysContainer = document.getElementById("map-overlays");
          if (overlaysContainer) {
            Object.entries(locations).forEach(([key, loc]: [string, any]) => {
              const major = data.current[`${key}Major` as keyof typeof data.current];
              const minor = data.current[`${key}Minor` as keyof typeof data.current];

              // Translate location label if available
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
              if (major === "None" && minor === "None") {
                const marker = document.createElement("div");
                marker.className = "location-marker";
                marker.style.left = `${loc.x}%`;
                marker.style.top = `${loc.y}%`;
                marker.innerHTML = `
                <div class="location-name">${locLabel}</div>
                <div class="location-pin"></div>
              `;
                overlaysContainer.appendChild(marker);
                return;
              }

              const marker = document.createElement("div");
              marker.className = "location-marker";
              marker.style.left = `${loc.x}%`;
              marker.style.top = `${loc.y}%`;
              marker.innerHTML = `
              <div class="location-name">${locLabel}</div>
              <div class="location-pin"></div>
              <div class="location-status">${statusHtml}</div>
            `;
              overlaysContainer.appendChild(marker);
            });
          }

          const forecastGrid = document.getElementById("forecast-grid");
          if (forecastGrid) {
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
        LOCATIONS,
        CONDITION_EMOJIS,
        this.icons,
        mapImageBase64,
        translations,
      );

      // Screenshot the container
      const element = await page.$(".container");
      if (!element) throw new Error("Container not found");

      const imageBuffer = await element.screenshot({ type: "png" });
      return imageBuffer as Buffer;
    } catch (error) {
      logger.error({ err: error }, "Error rendering HTML to image");
      throw error;
    } finally {
      if (page) await page.close();
    }
  }
}
