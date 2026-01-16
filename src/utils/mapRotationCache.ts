import { createHash } from "node:crypto";
import type { MapRotation } from "../types";
import * as mapRotationRepo from "../repositories/mapRotationRepository";
import { logger } from "./logger";

export interface RotationChange {
  hour: number;
  field: string;
  oldValue: string;
  newValue: string;
}

export interface UpdateResult {
  updated: boolean;
  changes: RotationChange[];
}

let cachedRotations: MapRotation[] | null = null;
let cachedHash: string | null = null;

export function computeRotationsHash(rotations: MapRotation[]): string {
  const data = JSON.stringify(rotations);
  return createHash("sha256").update(data).digest("hex");
}

export function invalidateCache(): void {
  cachedRotations = null;
  cachedHash = null;
  logger.info("Map rotations cache invalidated");
}

export async function getCachedRotations(): Promise<MapRotation[]> {
  // If we have cached data, return it
  if (cachedRotations !== null) {
    return cachedRotations;
  }

  // Fetch from database
  try {
    const rotations = await mapRotationRepo.getAllRotations();
    cachedRotations = rotations;
    cachedHash = computeRotationsHash(rotations);
    logger.debug("Map rotations loaded from database and cached");
    return rotations;
  } catch (error) {
    logger.error({ err: error }, "Failed to load rotations from database");
    throw error;
  }
}

export async function getCachedRotationByHour(hour: number): Promise<MapRotation | null> {
  const rotations = await getCachedRotations();
  return rotations.find((r) => r.hour === hour) ?? null;
}

export function getCachedHash(): string | null {
  return cachedHash;
}

function detectChanges(oldRotations: MapRotation[], newRotations: MapRotation[]): RotationChange[] {
  const changes: RotationChange[] = [];
  const fields: (keyof MapRotation)[] = [
    "damMinor",
    "damMajor",
    "buriedCityMinor",
    "buriedCityMajor",
    "spaceportMinor",
    "spaceportMajor",
    "blueGateMinor",
    "blueGateMajor",
    "stellaMontisMinor",
    "stellaMontisMajor",
  ];

  for (const newRot of newRotations) {
    const oldRot = oldRotations.find((r) => r.hour === newRot.hour);
    if (!oldRot) continue;

    for (const field of fields) {
      const oldVal = oldRot[field];
      const newVal = newRot[field];
      if (oldVal !== newVal) {
        changes.push({
          hour: newRot.hour,
          field,
          oldValue: String(oldVal),
          newValue: String(newVal),
        });
      }
    }
  }

  return changes;
}

export async function updateCacheIfChanged(newRotations: MapRotation[]): Promise<UpdateResult> {
  const newHash = computeRotationsHash(newRotations);
  const storedHash = await mapRotationRepo.getRotationsHash();

  // Always invalidate in-memory cache on sync to ensure freshness
  invalidateCache();

  if (storedHash === newHash) {
    logger.debug("Rotations hash unchanged, skipping database update");
    return { updated: false, changes: [] };
  }

  // Fetch old rotations to detect what changed
  let changes: RotationChange[] = [];
  try {
    const oldRotations = await mapRotationRepo.getAllRotations();
    if (oldRotations.length > 0) {
      changes = detectChanges(oldRotations, newRotations);
    }
  } catch (err) {
    logger.warn({ err }, "Could not fetch old rotations for change detection");
  }

  // Update database
  await mapRotationRepo.upsertRotations(newRotations);
  await mapRotationRepo.setRotationsHash(newHash);

  logger.info(
    `Map rotations updated, new hash: ${newHash.substring(0, 8)}..., ${changes.length} changes detected`,
  );
  return { updated: true, changes };
}
