-- Messenger Agenda: per-person contribution highlighting.
-- Stores the color legend (name, color, highlight, initials, lineCount) for
-- everyone who spoke inside a capture window.

alter table public.messenger_agenda_sessions
  add column if not exists contributors_json text not null default '[]';
