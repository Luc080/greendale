-- Einmalig im Supabase SQL-Editor ausführen
-- https://supabase.com/dashboard/project/kwtbtxebobjysxyxtsmg/sql

CREATE TABLE IF NOT EXISTS players (
  name       TEXT PRIMARY KEY,
  state      JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index für schnelle Lookups
CREATE INDEX IF NOT EXISTS players_name_idx ON players(name);
CREATE INDEX IF NOT EXISTS players_updated_idx ON players(updated_at);

-- Row Level Security deaktivieren (Server nutzt service_role)
ALTER TABLE players DISABLE ROW LEVEL SECURITY;
