import { logger } from "./logger";

interface Lock {
  userId: string;
  expiresAt: number;
  channelId: string;
  guildId: string;
  timeout: NodeJS.Timeout;
}

type ExpirationCallback = (
  messageId: string,
  channelId: string,
  guildId: string,
) => void | Promise<void>;

class InteractionLockManager {
  private locks: Map<string, Lock> = new Map();
  private readonly LOCK_DURATION_MS = 15000; // 15 seconds
  private readonly CLEANUP_INTERVAL_MS = 60000; // 1 minute
  private expirationCallback: ExpirationCallback | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Start periodic cleanup to remove any orphaned locks
    this.startCleanup();
  }

  private startCleanup(): void {
    if (this.cleanupInterval) return;

    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      let cleaned = 0;

      for (const [messageId, lock] of this.locks.entries()) {
        if (lock.expiresAt <= now) {
          clearTimeout(lock.timeout);
          this.locks.delete(messageId);
          cleaned++;
        }
      }

      if (cleaned > 0) {
        logger.debug(
          { cleaned, remaining: this.locks.size },
          "Cleaned up expired interaction locks",
        );
      }
    }, this.CLEANUP_INTERVAL_MS);

    // Don't prevent process from exiting
    this.cleanupInterval.unref();
  }

  setExpirationCallback(callback: ExpirationCallback) {
    this.expirationCallback = callback;
  }

  /**
   * @param messageId The ID of the message to lock.
   * @param userId The ID of the user requesting the lock.
   * @param channelId The ID of the channel.
   * @param guildId The ID of the guild.
   * @returns True if the lock was acquired, false otherwise.
   */
  acquireLock(messageId: string, userId: string, channelId: string, guildId: string): boolean {
    const now = Date.now();
    const currentLock = this.locks.get(messageId);

    // If locked by someone else and not expired
    if (currentLock && currentLock.userId !== userId && currentLock.expiresAt > now) {
      return false;
    }

    // Clear existing timeout if refreshing
    if (currentLock) {
      clearTimeout(currentLock.timeout);
    }

    // Set new lock
    const timeout = setTimeout(async () => {
      this.locks.delete(messageId);
      if (this.expirationCallback) {
        try {
          await this.expirationCallback(messageId, channelId, guildId);
        } catch (error) {
          logger.error(
            { err: error, messageId, channelId, guildId },
            "Error in lock expiration callback",
          );
        }
      }
    }, this.LOCK_DURATION_MS);

    this.locks.set(messageId, {
      userId,
      expiresAt: now + this.LOCK_DURATION_MS,
      channelId,
      guildId,
      timeout,
    });

    return true;
  }

  /**
   * Checks if a user is allowed to interact with a message.
   * @param messageId The ID of the message.
   * @param userId The ID of the user.
   * @returns True if allowed, false if blocked.
   */
  canInteract(messageId: string, userId: string): boolean {
    const now = Date.now();
    const currentLock = this.locks.get(messageId);

    // No lock or lock expired
    if (!currentLock || currentLock.expiresAt <= now) {
      if (currentLock) {
        clearTimeout(currentLock.timeout);
        this.locks.delete(messageId); // Clean up expired lock
      }
      return true;
    }

    // Locked by same user
    if (currentLock.userId === userId) {
      return true;
    }

    // Locked by someone else
    return false;
  }

  /**
   * Gets the remaining time for a lock in seconds.
   * @param messageId The ID of the message.
   * @returns Seconds remaining or 0 if not locked/expired.
   */
  getRemainingTime(messageId: string): number {
    const now = Date.now();
    const currentLock = this.locks.get(messageId);

    if (!currentLock || currentLock.expiresAt <= now) {
      return 0;
    }

    return Math.ceil((currentLock.expiresAt - now) / 1000);
  }
}

export const interactionLockManager = new InteractionLockManager();
