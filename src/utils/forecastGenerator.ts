import type { APIEmbedField } from "discord.js";
import { CONDITION_EMOJIS } from "../config/mapRotation";
import type { MapRotation } from "../types";
import { translateEvent } from "./i18n";

interface ForecastOptions {
  t: (key: string, options?: any) => string;
  currentHour: number;
  nextRotationTs: number;
  filter: { type: "location"; value: string } | { type: "event"; value: string };
  mobileFriendly: boolean;
  rotations: MapRotation[];
}

const LOCATIONS = ["dam", "buriedCity", "spaceport", "blueGate", "stellaMontis"];
const LOCATION_KEY_MAP: Record<string, string> = {
  dam: "dam",
  buriedCity: "buried_city",
  spaceport: "spaceport",
  blueGate: "blue_gate",
  stellaMontis: "stella_montis",
};

export function generateForecast(options: ForecastOptions): {
  descriptionSuffix: string;
  fields: APIEmbedField[];
} {
  const { t, currentHour, nextRotationTs, filter, mobileFriendly, rotations } = options;
  let description = "";
  let hasEvents = false;

  // Arrays for desktop columns
  let col1 = ""; // Time
  let col2 = ""; // Content (Events or Locations)

  for (let i = 1; i <= 24; i++) {
    const hourIndex = (currentHour + i) % 24;
    const rotation = rotations.find((r) => r.hour === hourIndex);
    if (!rotation) continue;
    const timestamp = nextRotationTs + (i - 1) * 3600;
    const timeLabel = `<t:${timestamp}:R>`;

    let contentText = "";

    if (filter.type === "location") {
      const location = filter.value;
      const major = rotation[`${location}Major` as keyof typeof rotation];
      const minor = rotation[`${location}Minor` as keyof typeof rotation];

      if (major !== "None" || minor !== "None") {
        if (major !== "None")
          contentText += `${CONDITION_EMOJIS[major]} ${translateEvent(t, String(major))} `;
        if (minor !== "None")
          contentText += `${CONDITION_EMOJIS[minor]} ${translateEvent(t, String(minor))}`;
      }
    } else {
      // filter.type === 'event'
      const eventType = filter.value;
      const occurringLocations = [];
      for (const loc of LOCATIONS) {
        if (
          rotation[`${loc}Major` as keyof typeof rotation] === eventType ||
          rotation[`${loc}Minor` as keyof typeof rotation] === eventType
        ) {
          const locKey = LOCATION_KEY_MAP[loc] || loc;
          const locName = t(`map_rotation.locations.${locKey}`);
          occurringLocations.push(locName);
        }
      }
      if (occurringLocations.length > 0) {
        contentText = occurringLocations.join(", ");
      }
    }

    if (contentText) {
      hasEvents = true;
      if (mobileFriendly) {
        description += `**${timeLabel}** • ${contentText}\n`;
      } else {
        col1 += `${timeLabel}\n`;
        col2 += `${contentText}\n`;
      }
    }
  }

  if (!hasEvents) {
    return {
      descriptionSuffix: t("map_rotation.forecast.no_events"),
      fields: [],
    };
  }

  if (mobileFriendly) {
    return {
      descriptionSuffix: description,
      fields: [],
    };
  } else {
    return {
      descriptionSuffix: "",
      fields: [
        { name: t("map_rotation.forecast.time_until"), value: col1, inline: true },
        {
          name:
            filter.type === "location"
              ? t("map_rotation.forecast.conditions")
              : t("map_rotation.forecast.locations"),
          value: col2,
          inline: true,
        },
        { name: "\u200b", value: "\u200b", inline: true },
      ],
    };
  }
}
