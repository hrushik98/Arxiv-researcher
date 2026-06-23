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

