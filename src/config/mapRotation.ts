import type { MapRotation } from "../types";
import { getCachedRotations, getCachedRotationByHour } from "../utils/mapRotationCache";
import { logger } from "../utils/logger";

// Go to https://discord.com/developers/applications/your-app-id/emojis and add the emojis from `./assets/` and copy the emoji ID and replace them in the object below.
export const CONDITION_EMOJIS: { [key: string]: string } = {
  Harvester: "<:harvester:1444519669250658504>",
  Night: "<:nightraid:1444519662711996637>",
  Husks: "<:husks:1444519668063797248>",
  Blooms: "<:lush:1444519666209787965>",
  Storm: "<:electro:1444519670626390146>",
  Caches: "<:cache:1444519671918366882>",
  Probes: "<:probe:1444519661050925057>",
  Tower: "<:spacetower_loot:1444519659310416043>",
  Bunker: "<:bunker:1444519673289773238>",
  Matriarch: "<:matriarch:1444519663860973620>",
  Cold: "<:cold:1450872893947904102>",
  Gate: "<:gate:1450872856740237353>",
  Birds: "<:birds:1466170845780246655>",
  None: " ",
};

export const CONDITION_COLORS: { [key: string]: number } = {
  Harvester: 0xd80c1a, // Red
  Night: 0xd80c1a, // Red
  Husks: 0xeed722, // Yellow
  Blooms: 0xeed722, // Yellow
  Storm: 0xd80c1a, // Red
  Caches: 0xeed722, // Yellow
  Probes: 0xeed722, // Yellow
  Tower: 0xd80c1a, // Red
  Bunker: 0xd80c1a, // Red
  Matriarch: 0xd80c1a, // Red
  Cold: 0xd80c1a, // Red
  Gate: 0xd80c1a, // Red
  Birds: 0xeed722, // Yellow
  None: 0x40fd86, // Green
};

// 24-hour map rotation schedule (UTC)
export const MAP_ROTATIONS: MapRotation[] = [
  {
    hour: 0,
    damMinor: "None",
    damMajor: "None",
    buriedCityMinor: "Husks",
    buriedCityMajor: "None",
    spaceportMinor: "None",
    spaceportMajor: "Bunker",
    blueGateMinor: "None",
    blueGateMajor: "Cold",
    stellaMontisMinor: "None",
    stellaMontisMajor: "None",
  },
  {
    hour: 1,
    damMinor: "Caches",
    damMajor: "None",
    buriedCityMinor: "None",
    buriedCityMajor: "None",
    spaceportMinor: "None",
    spaceportMajor: "None",
    blueGateMinor: "None",
    blueGateMajor: "Cold",
    stellaMontisMinor: "None",
    stellaMontisMajor: "None",
  },
  {
    hour: 2,
    damMinor: "None",
    damMajor: "Storm",
    buriedCityMinor: "None",
    buriedCityMajor: "None",
    spaceportMinor: "None",
    spaceportMajor: "Cold",
    blueGateMinor: "Matriarch",
    blueGateMajor: "None",
    stellaMontisMinor: "None",
    stellaMontisMajor: "Night",
  },
  {
    hour: 3,
    damMinor: "None",
    damMajor: "None",
    buriedCityMinor: "None",
    buriedCityMajor: "None",
    spaceportMinor: "Matriarch",
    spaceportMajor: "Cold",
    blueGateMinor: "None",
    blueGateMajor: "Storm",
    stellaMontisMinor: "None",
    stellaMontisMajor: "None",
  },
  {
    hour: 4,
    damMinor: "None",
    damMajor: "Cold",
    buriedCityMinor: "Caches",
    buriedCityMajor: "Night",
    spaceportMinor: "None",
    spaceportMajor: "None",
    blueGateMinor: "None",
    blueGateMajor: "None",
    stellaMontisMinor: "None",
    stellaMontisMajor: "None",
  },
  {
    hour: 5,
    damMinor: "Matriarch",
    damMajor: "Cold",
    buriedCityMinor: "None",
    buriedCityMajor: "None",
    spaceportMinor: "None",
    spaceportMajor: "Night",
    blueGateMinor: "Husks",
    blueGateMajor: "None",
    stellaMontisMinor: "None",
    stellaMontisMajor: "None",
  },
  {
    hour: 6,
    damMinor: "None",
    damMajor: "None",
    buriedCityMinor: "None",
    buriedCityMajor: "Cold",
    spaceportMinor: "None",
    spaceportMajor: "None",
    blueGateMinor: "None",
    blueGateMajor: "Gate",
    stellaMontisMinor: "None",
    stellaMontisMajor: "Night",
  },
  {
    hour: 7,
    damMinor: "None",
    damMajor: "Night",
    buriedCityMinor: "None",
    buriedCityMajor: "Cold",
    spaceportMinor: "Tower",
    spaceportMajor: "None",
    blueGateMinor: "None",
    blueGateMajor: "None",
    stellaMontisMinor: "None",
    stellaMontisMajor: "None",
  },
  {
    hour: 8,
    damMinor: "None",
    damMajor: "None",
    buriedCityMinor: "Husks",
    buriedCityMajor: "None",
    spaceportMinor: "None",
    spaceportMajor: "Bunker",
    blueGateMinor: "Matriarch",
    blueGateMajor: "Cold",
    stellaMontisMinor: "None",
    stellaMontisMajor: "None",
  },
  {
    hour: 9,
    damMinor: "Harvester",
    damMajor: "None",
    buriedCityMinor: "None",
    buriedCityMajor: "None",
    spaceportMinor: "None",
    spaceportMajor: "None",
    blueGateMinor: "None",
    blueGateMajor: "Cold",
    stellaMontisMinor: "None",
    stellaMontisMajor: "None",
  },
  {
    hour: 10,
    damMinor: "None",
    damMajor: "Storm",
    buriedCityMinor: "None",
    buriedCityMajor: "None",
    spaceportMinor: "None",
    spaceportMajor: "Cold",
    blueGateMinor: "None",
    blueGateMajor: "None",
    stellaMontisMinor: "None",
    stellaMontisMajor: "Night",
  },
  {
    hour: 11,
    damMinor: "None",
    damMajor: "None",
    buriedCityMinor: "None",
    buriedCityMajor: "None",
    spaceportMinor: "Caches",
    spaceportMajor: "Cold",
    blueGateMinor: "Harvester",
    blueGateMajor: "Night",
    stellaMontisMinor: "None",
    stellaMontisMajor: "None",
  },
  {
    hour: 12,
    damMinor: "None",
    damMajor: "Cold",
    buriedCityMinor: "Caches",
    buriedCityMajor: "Night",
    spaceportMinor: "None",
    spaceportMajor: "None",
    blueGateMinor: "None",
    blueGateMajor: "None",
    stellaMontisMinor: "None",
    stellaMontisMajor: "None",
  },
  {
    hour: 13,
    damMinor: "Matriarch",
    damMajor: "Cold",
    buriedCityMinor: "None",
    buriedCityMajor: "None",
    spaceportMinor: "None",
    spaceportMajor: "Night",
    blueGateMinor: "None",
    blueGateMajor: "None",
    stellaMontisMinor: "None",
    stellaMontisMajor: "None",
  },
  {
    hour: 14,
    damMinor: "None",
    damMajor: "None",
    buriedCityMinor: "None",
    buriedCityMajor: "Cold",
    spaceportMinor: "None",
    spaceportMajor: "None",
    blueGateMinor: "Matriarch",
    blueGateMajor: "Storm",
    stellaMontisMinor: "None",
    stellaMontisMajor: "Night",
  },
  {
    hour: 15,
    damMinor: "None",
    damMajor: "Night",
    buriedCityMinor: "None",
    buriedCityMajor: "Cold",
    spaceportMinor: "Tower",
    spaceportMajor: "None",
    blueGateMinor: "None",
    blueGateMajor: "None",
    stellaMontisMinor: "None",
    stellaMontisMajor: "None",
  },
  {
    hour: 16,
    damMinor: "None",
    damMajor: "None",
    buriedCityMinor: "Husks",
    buriedCityMajor: "None",
    spaceportMinor: "None",
    spaceportMajor: "Bunker",
    blueGateMinor: "None",
    blueGateMajor: "Cold",
    stellaMontisMinor: "None",
    stellaMontisMajor: "None",
  },
  {
    hour: 17,
    damMinor: "Husks",
    damMajor: "None",
    buriedCityMinor: "None",
    buriedCityMajor: "None",
    spaceportMinor: "None",
    spaceportMajor: "None",
    blueGateMinor: "Caches",
    blueGateMajor: "Cold",
    stellaMontisMinor: "None",
    stellaMontisMajor: "None",
  },
  {
    hour: 18,
    damMinor: "None",
    damMajor: "Storm",
    buriedCityMinor: "None",
    buriedCityMajor: "None",
    spaceportMinor: "None",
    spaceportMajor: "Cold",
    blueGateMinor: "None",
    blueGateMajor: "None",
    stellaMontisMinor: "None",
    stellaMontisMajor: "Night",
  },
  {
    hour: 19,
    damMinor: "None",
    damMajor: "None",
    buriedCityMinor: "None",
    buriedCityMajor: "None",
    spaceportMinor: "Matriarch",
    spaceportMajor: "Cold",
    blueGateMinor: "None",
    blueGateMajor: "Gate",
    stellaMontisMinor: "None",
    stellaMontisMajor: "None",
  },
  {
    hour: 20,
    damMinor: "None",
    damMajor: "Cold",
    buriedCityMinor: "Caches",
    buriedCityMajor: "Night",
    spaceportMinor: "None",
    spaceportMajor: "None",
    blueGateMinor: "Harvester",
    blueGateMajor: "None",
    stellaMontisMinor: "None",
    stellaMontisMajor: "None",
  },
  {
    hour: 21,
    damMinor: "Harvester",
    damMajor: "Cold",
    buriedCityMinor: "None",
    buriedCityMajor: "None",
    spaceportMinor: "None",
    spaceportMajor: "Night",
    blueGateMinor: "None",
    blueGateMajor: "None",
    stellaMontisMinor: "None",
    stellaMontisMajor: "None",
  },
  {
    hour: 22,
    damMinor: "None",
    damMajor: "None",
    buriedCityMinor: "None",
    buriedCityMajor: "Cold",
    spaceportMinor: "None",
    spaceportMajor: "None",
    blueGateMinor: "None",
    blueGateMajor: "Night",
    stellaMontisMinor: "None",
    stellaMontisMajor: "Night",
  },
  {
    hour: 23,
    damMinor: "None",
    damMajor: "Night",
    buriedCityMinor: "None",
    buriedCityMajor: "Cold",
    spaceportMinor: "Harvester",
    spaceportMajor: "None",
    blueGateMinor: "Husks",
    blueGateMajor: "None",
    stellaMontisMinor: "None",
    stellaMontisMajor: "None",
  },
];

// Default fallback rotation when database is unavailable
const FALLBACK_ROTATION: MapRotation = {
  hour: 0,
  damMinor: "None",
  damMajor: "None",
  buriedCityMinor: "None",
  buriedCityMajor: "None",
  spaceportMinor: "None",
  spaceportMajor: "None",
  blueGateMinor: "None",
  blueGateMajor: "None",
  stellaMontisMinor: "None",
  stellaMontisMajor: "None",
};

export async function getCurrentRotation(): Promise<MapRotation> {
  const now = new Date();
  const currentHour = now.getUTCHours();

  try {
    const rotation = await getCachedRotationByHour(currentHour);
    if (rotation) return rotation;
  } catch (error) {
    logger.error({ err: error }, "Failed to get current rotation from cache, using fallback");
  }

  // Fallback to hardcoded data if cache/DB fails
  return MAP_ROTATIONS[currentHour] ?? { ...FALLBACK_ROTATION, hour: currentHour };
}

export async function getNextRotation(): Promise<MapRotation> {
  const now = new Date();
  const currentHour = now.getUTCHours();
  const nextHour = (currentHour + 1) % 24;

  try {
    const rotation = await getCachedRotationByHour(nextHour);
    if (rotation) return rotation;
  } catch (error) {
    logger.error({ err: error }, "Failed to get next rotation from cache, using fallback");
  }

  // Fallback to hardcoded data if cache/DB fails
  return MAP_ROTATIONS[nextHour] ?? { ...FALLBACK_ROTATION, hour: nextHour };
}

export async function getAllRotations(): Promise<MapRotation[]> {
  try {
    return await getCachedRotations();
  } catch (error) {
    logger.error({ err: error }, "Failed to get all rotations from cache, using fallback");
    return MAP_ROTATIONS;
  }
}

export function getNextRotationTimestamp(): number {
  const now = new Date();
  const nextHour = new Date(now);
  nextHour.setUTCHours(now.getUTCHours() + 1, 0, 0, 0);
  return Math.floor(nextHour.getTime() / 1000);
}

export function formatCondition(condition: string): string {
  const emoji = CONDITION_EMOJIS[condition] || "❓";
  return `${emoji} ${condition}`;
}

export function formatLocationEvents(major: string, minor: string): string {
  const events = [];

  if (major !== "None") {
    events.push(`${formatCondition(major)} (2x)`);
  }

  if (minor !== "None") {
    events.push(formatCondition(minor));
  }

  if (events.length === 0) {
    return "None";
  }

  return events.join("\n");
}
