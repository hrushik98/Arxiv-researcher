-- Auth schema. Email/password only; password is bcrypt-hashed before storage.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS highlights (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  paper_id      text NOT NULL,
  text          text NOT NULL,
  note          text,
  color         text NOT NULL DEFAULT '#ffff8d',
  page_number   integer NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  paper_id      text NOT NULL,
  role          text NOT NULL CHECK (role IN ('user', 'assistant')),
  content       text NOT NULL,
  highlight     text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Citations returned alongside an assistant answer, persisted so they survive reloads.
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS citations jsonb;

-- Web sources (title + url) used when the paper's own context didn't answer the
-- question, persisted alongside citations so they survive reloads.
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS web_sources jsonb;

-- Groups messages into distinct conversations per paper, so "New Chat" can start a
-- fresh thread and "History" can list previous ones.
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS session_id uuid;

-- Backfill: fold any pre-existing rows (created before session_id existed) into one
-- session per (user, paper) so old history doesn't fragment into one session/message.
UPDATE chat_messages cm
SET session_id = g.session_id
FROM (
  SELECT user_id, paper_id, gen_random_uuid() AS session_id
  FROM chat_messages
  WHERE session_id IS NULL
  GROUP BY user_id, paper_id
) g
WHERE cm.user_id = g.user_id AND cm.paper_id = g.paper_id AND cm.session_id IS NULL;

ALTER TABLE chat_messages ALTER COLUMN session_id SET DEFAULT gen_random_uuid();
ALTER TABLE chat_messages ALTER COLUMN session_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS chat_messages_session_idx ON chat_messages (user_id, paper_id, session_id, created_at);

