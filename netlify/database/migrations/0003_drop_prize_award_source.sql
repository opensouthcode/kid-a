DROP INDEX IF EXISTS prize_awards_passport_completion_per_kid_idx;

ALTER TABLE prize_awards
  DROP COLUMN IF EXISTS source;
