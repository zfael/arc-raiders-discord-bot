import type { MapRotation } from "../types";

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
  None: 0x40fd86, // Green
};

// 24-hour map rotation schedule (UTC)
export const MAP_ROTATIONS: MapRotation[] = [
  {
    hour: 0,
    damMinor: "Matriarch",
    damMajor: "None",
    buriedCityMinor: "None",
    buriedCityMajor: "Night",
    spaceportMinor: "Harvester",
    spaceportMajor: "None",
    blueGateMinor: "None",
    blueGateMajor: "None",
    stellaMontisMinor: "None",
    stellaMontisMajor: "None",
  },
  {
    hour: 1,
    damMinor: "None",
    damMajor: "None",
    buriedCityMinor: "None",
    buriedCityMajor: "None",
    spaceportMinor: "None",
    spaceportMajor: "Storm",
    blueGateMinor: "None",
    blueGateMajor: "None",
    stellaMontisMinor: "None",
    stellaMontisMajor: "None",
  },
  {
    hour: 2,
    damMinor: "None",
    damMajor: "Night",
    buriedCityMinor: "Caches",
    buriedCityMajor: "None",
    spaceportMinor: "None",
    spaceportMajor: "None",
    blueGateMinor: "Husks",
    blueGateMajor: "None",
    stellaMontisMinor: "None",
    stellaMontisMajor: "Night",
  },
  {
    hour: 3,
    damMinor: "Blooms",
    damMajor: "None",
    buriedCityMinor: "None",
    buriedCityMajor: "Night",
    spaceportMinor: "Matriarch",
    spaceportMajor: "None",
    blueGateMinor: "None",
    blueGateMajor: "None",
    stellaMontisMinor: "None",
    stellaMontisMajor: "None",
  },
  {
    hour: 4,
    damMinor: "None",
    damMajor: "None",
    buriedCityMinor: "None",
    buriedCityMajor: "None",
    spaceportMinor: "None",
    spaceportMajor: "Night",
    blueGateMinor: "None",
    blueGateMajor: "Night",
    stellaMontisMinor: "None",
    stellaMontisMajor: "None",
  },
  {
    hour: 5,
    damMinor: "None",
    damMajor: "Storm",
    buriedCityMinor: "Husks",
    buriedCityMajor: "None",
    spaceportMinor: "None",
    spaceportMajor: "None",
    blueGateMinor: "Harvester",
    blueGateMajor: "None",
    stellaMontisMinor: "None",
    stellaMontisMajor: "Night",
  },
  {
    hour: 6,
    damMinor: "Probes",
    damMajor: "None",
    buriedCityMinor: "None",
    buriedCityMajor: "Night",
    spaceportMinor: "Tower",
    spaceportMajor: "None",
    blueGateMinor: "None",
    blueGateMajor: "None",
    stellaMontisMinor: "None",
    stellaMontisMajor: "None",
  },
  {
    hour: 7,
    damMinor: "None",
    damMajor: "None",
    buriedCityMinor: "None",
    buriedCityMajor: "None",
    spaceportMinor: "None",
    spaceportMajor: "Storm",
    blueGateMinor: "None",
    blueGateMajor: "Storm",
    stellaMontisMinor: "None",
    stellaMontisMajor: "None",
  },
  {
    hour: 8,
    damMinor: "None",
    damMajor: "Night",
    buriedCityMinor: "Blooms",
    buriedCityMajor: "None",
    spaceportMinor: "None",
    spaceportMajor: "None",
    blueGateMinor: "Probes",
    blueGateMajor: "None",
    stellaMontisMinor: "None",
    stellaMontisMajor: "Night",
  },
  {
    hour: 9,
    damMinor: "Harvester",
    damMajor: "None",
    buriedCityMinor: "None",
    buriedCityMajor: "Night",
    spaceportMinor: "Probes",
    spaceportMajor: "None",
    blueGateMinor: "Blooms",
    blueGateMajor: "None",
    stellaMontisMinor: "None",
    stellaMontisMajor: "None",
  },
  {
    hour: 10,
    damMinor: "Husks",
    damMajor: "None",
    buriedCityMinor: "None",
    buriedCityMajor: "None",
    spaceportMinor: "None",
    spaceportMajor: "Night",
    blueGateMinor: "None",
    blueGateMajor: "Night",
    stellaMontisMinor: "None",
    stellaMontisMajor: "None",
  },
  {
    hour: 11,
    damMinor: "None",
    damMajor: "Storm",
    buriedCityMinor: "Probes",
    buriedCityMajor: "None",
    spaceportMinor: "None",
    spaceportMajor: "None",
    blueGateMinor: "Matriarch",
    blueGateMajor: "None",
    stellaMontisMinor: "None",
    stellaMontisMajor: "Night",
  },
  {
    hour: 12,
    damMinor: "None",
    damMajor: "None",
    buriedCityMinor: "None",
    buriedCityMajor: "Night",
    spaceportMinor: "Blooms",
    spaceportMajor: "None",
    blueGateMinor: "None",
    blueGateMajor: "None",
    stellaMontisMinor: "None",
    stellaMontisMajor: "None",
  },
  {
    hour: 13,
    damMinor: "Probes",
    damMajor: "None",
    buriedCityMinor: "None",
    buriedCityMajor: "None",
    spaceportMinor: "None",
    spaceportMajor: "Storm",
    blueGateMinor: "None",
    blueGateMajor: "None",
    stellaMontisMinor: "None",
    stellaMontisMajor: "None",
  },
  {
    hour: 14,
    damMinor: "None",
    damMajor: "Night",
    buriedCityMinor: "Husks",
    buriedCityMajor: "None",
    spaceportMinor: "None",
    spaceportMajor: "None",
    blueGateMinor: "Caches",
    blueGateMajor: "None",
    stellaMontisMinor: "None",
    stellaMontisMajor: "Night",
  },
  {
    hour: 15,
    damMinor: "None",
    damMajor: "None",
    buriedCityMinor: "None",
    buriedCityMajor: "Night",
    spaceportMinor: "Caches",
    spaceportMajor: "None",
    blueGateMinor: "None",
    blueGateMajor: "None",
    stellaMontisMinor: "None",
    stellaMontisMajor: "None",
  },
  {
    hour: 16,
    damMinor: "Harvester",
    damMajor: "None",
    buriedCityMinor: "None",
    buriedCityMajor: "None",
    spaceportMinor: "None",
    spaceportMajor: "Storm",
    blueGateMinor: "None",
    blueGateMajor: "Storm",
    stellaMontisMinor: "None",
    stellaMontisMajor: "None",
  },
  {
    hour: 17,
    damMinor: "Blooms",
    damMajor: "Storm",
    buriedCityMinor: "Blooms",
    buriedCityMajor: "None",
    spaceportMinor: "None",
    spaceportMajor: "None",
    blueGateMinor: "Harvester",
    blueGateMajor: "None",
    stellaMontisMinor: "None",
    stellaMontisMajor: "Night",
  },
  {
    hour: 18,
    damMinor: "None",
    damMajor: "None",
    buriedCityMinor: "None",
    buriedCityMajor: "Night",
    spaceportMinor: "Harvester",
    spaceportMajor: "None",
    blueGateMinor: "Husks",
    blueGateMajor: "None",
    stellaMontisMinor: "None",
    stellaMontisMajor: "None",
  },
  {
    hour: 19,
    damMinor: "None",
    damMajor: "None",
    buriedCityMinor: "None",
    buriedCityMajor: "None",
    spaceportMinor: "None",
    spaceportMajor: "Night",
    blueGateMinor: "None",
    blueGateMajor: "Night",
    stellaMontisMinor: "None",
    stellaMontisMajor: "None",
  },
  {
    hour: 20,
    damMinor: "Matriarch",
    damMajor: "Night",
    buriedCityMinor: "Caches",
    buriedCityMajor: "None",
    spaceportMinor: "None",
    spaceportMajor: "None",
    blueGateMinor: "Blooms",
    blueGateMajor: "None",
    stellaMontisMinor: "None",
    stellaMontisMajor: "Night",
  },
  {
    hour: 21,
    damMinor: "None",
    damMajor: "None",
    buriedCityMinor: "None",
    buriedCityMajor: "Night",
    spaceportMinor: "Matriarch",
    spaceportMajor: "None",
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
    buriedCityMajor: "None",
    spaceportMinor: "None",
    spaceportMajor: "Storm",
    blueGateMinor: "None",
    blueGateMajor: "Storm",
    stellaMontisMinor: "None",
    stellaMontisMajor: "None",
  },
  {
    hour: 23,
    damMinor: "Caches",
    damMajor: "Storm",
    buriedCityMinor: "Probes",
    buriedCityMajor: "None",
    spaceportMinor: "None",
    spaceportMajor: "None",
    blueGateMinor: "Matriarch",
    blueGateMajor: "None",
    stellaMontisMinor: "None",
    stellaMontisMajor: "Night",
  },
];

export function getCurrentRotation(): MapRotation {
  const now = new Date();
  const currentHour = now.getUTCHours();
  return MAP_ROTATIONS[currentHour];
}

export function getNextRotation(): MapRotation {
  const now = new Date();
  const currentHour = now.getUTCHours();
  const nextHour = (currentHour + 1) % 24;
  return MAP_ROTATIONS[nextHour];
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
