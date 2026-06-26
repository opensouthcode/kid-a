CREATE TABLE IF NOT EXISTS conference_settings (
  id text PRIMARY KEY DEFAULT 'default',
  kid_id_prefix text NOT NULL,
  short_name text NOT NULL,
  title text NOT NULL
);

CREATE TABLE IF NOT EXISTS kids (
  id text PRIMARY KEY,
  name text NOT NULL,
  age integer NOT NULL CHECK (age > 0),
  gender text NOT NULL,
  language text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS passport_activities (
  kid_id text NOT NULL,
  activity_id integer NOT NULL,
  completed_at timestamptz,
  PRIMARY KEY (kid_id, activity_id)
);

CREATE TABLE IF NOT EXISTS prizes (
  id text PRIMARY KEY,
  title text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('final', 'normal', 'valuable')),
  initial_units integer NOT NULL CHECK (initial_units >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS prize_awards (
  id text PRIMARY KEY,
  kid_id text NOT NULL,
  prize_id text NOT NULL,
  source text CHECK (source IS NULL OR source IN ('passportCompletion', 'wheel')),
  awarded_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS magic_link_tokens (
  token_hash text PRIMARY KEY,
  role text NOT NULL CHECK (role IN ('desk', 'lead', 'wheel')),
  activity_id integer,
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS passport_activities_kid_id_idx
  ON passport_activities (kid_id);

CREATE INDEX IF NOT EXISTS prize_awards_kid_id_idx
  ON prize_awards (kid_id);

CREATE INDEX IF NOT EXISTS prize_awards_prize_id_idx
  ON prize_awards (prize_id);

CREATE UNIQUE INDEX IF NOT EXISTS prize_awards_passport_completion_per_kid_idx
  ON prize_awards (kid_id)
  WHERE source = 'passportCompletion';

CREATE INDEX IF NOT EXISTS magic_link_tokens_expires_at_idx
  ON magic_link_tokens (expires_at);
