-- Migration: Add feedback table for user feedback collection
-- Rate limiting is enforced at application level (10 min between submissions per user)

CREATE TABLE IF NOT EXISTS feedback (
  id SERIAL PRIMARY KEY,
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  feedback_type TEXT NOT NULL CHECK (feedback_type IN ('bug', 'suggestion', 'general')),
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for rate limiting queries (check last submission by user)
CREATE INDEX idx_feedback_user_rate_limit ON feedback(user_id, created_at DESC);

-- Index for querying feedback by guild
CREATE INDEX idx_feedback_guild ON feedback(guild_id);

-- Comments
COMMENT ON TABLE feedback IS 'User feedback submissions from Discord bot';
COMMENT ON COLUMN feedback.guild_id IS 'Discord guild/server ID where feedback was submitted';
COMMENT ON COLUMN feedback.user_id IS 'Discord user ID who submitted the feedback';
COMMENT ON COLUMN feedback.feedback_type IS 'Type of feedback: bug, suggestion, or general';
COMMENT ON COLUMN feedback.message IS 'Feedback message content';
COMMENT ON COLUMN feedback.created_at IS 'Timestamp when feedback was submitted';
