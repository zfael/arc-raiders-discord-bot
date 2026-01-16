import { supabase } from "../utils/supabaseClient";
import { logger } from "../utils/logger";

const FEEDBACK_TABLE = "feedback";
const RATE_LIMIT_MINUTES = 10;

export type FeedbackType = "bug" | "suggestion" | "general";

interface FeedbackRow {
  id: number;
  guild_id: string;
  user_id: string;
  feedback_type: FeedbackType;
  message: string;
  created_at: string;
}

export interface Feedback {
  id: number;
  guildId: string;
  userId: string;
  feedbackType: FeedbackType;
  message: string;
  createdAt: string;
}

function rowToFeedback(row: FeedbackRow): Feedback {
  return {
    id: row.id,
    guildId: row.guild_id,
    userId: row.user_id,
    feedbackType: row.feedback_type,
    message: row.message,
    createdAt: row.created_at,
  };
}

/**
 * Saves feedback to the database
 */
export async function saveFeedback(
  guildId: string,
  userId: string,
  feedbackType: FeedbackType,
  message: string,
): Promise<Feedback> {
  const { data, error } = await supabase
    .from(FEEDBACK_TABLE)
    .insert({
      guild_id: guildId,
      user_id: userId,
      feedback_type: feedbackType,
      message: message,
    })
    .select()
    .single();

  if (error) {
    logger.error({ err: error }, "Failed to save feedback");
    throw error;
  }

  logger.info({ guildId, userId, feedbackType }, "Feedback saved successfully");

  return rowToFeedback(data as FeedbackRow);
}

/**
 * Gets the last submission time for a user
 */
export async function getLastSubmissionTime(userId: string): Promise<Date | null> {
  const { data, error } = await supabase
    .from(FEEDBACK_TABLE)
    .select("created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    logger.error({ err: error }, "Failed to get last submission time");
    throw error;
  }

  return data ? new Date(data.created_at) : null;
}

/**
 * Checks if a user can submit feedback (rate limit: 10 minutes between submissions)
 * Returns { canSubmit: true } or { canSubmit: false, remainingMinutes: number }
 */
export async function canSubmitFeedback(
  userId: string,
): Promise<{ canSubmit: true } | { canSubmit: false; remainingMinutes: number }> {
  const lastSubmission = await getLastSubmissionTime(userId);

  if (!lastSubmission) {
    return { canSubmit: true };
  }

  const now = new Date();
  const diffMs = now.getTime() - lastSubmission.getTime();
  const diffMinutes = diffMs / (1000 * 60);

  if (diffMinutes >= RATE_LIMIT_MINUTES) {
    return { canSubmit: true };
  }

  const remainingMinutes = Math.ceil(RATE_LIMIT_MINUTES - diffMinutes);
  return { canSubmit: false, remainingMinutes };
}
