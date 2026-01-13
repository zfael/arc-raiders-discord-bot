import { createHash } from "node:crypto";
import type { MapRotation } from "../types";
import * as mapRotationRepo from "../repositories/mapRotationRepository";
import { logger } from "./logger";

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

export async function updateCacheIfChanged(newRotations: MapRotation[]): Promise<boolean> {
  const newHash = computeRotationsHash(newRotations);
  const storedHash = await mapRotationRepo.getRotationsHash();

  if (storedHash === newHash) {
    logger.debug("Rotations hash unchanged, skipping update");
    return false;
  }

  // Update database
  await mapRotationRepo.upsertRotations(newRotations);
  await mapRotationRepo.setRotationsHash(newHash);

  // Invalidate cache so next read fetches fresh data
  invalidateCache();

  logger.info(`Map rotations updated, new hash: ${newHash.substring(0, 8)}...`);
  return true;
}
