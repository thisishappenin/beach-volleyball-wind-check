-- Run this in the Supabase SQL editor to enable session rating / learning feature.

CREATE TABLE IF NOT EXISTS session_ratings (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  location_id  TEXT NOT NULL,
  date         DATE NOT NULL,
  slot         TEXT NOT NULL CHECK (slot IN ('morning', 'afternoon')),
  rating       INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 10),
  would_play   BOOLEAN NOT NULL,
  model_score  INTEGER,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, location_id, date, slot)
);

ALTER TABLE session_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own ratings"
  ON session_ratings FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
