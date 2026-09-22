import { neon } from '@neondatabase/serverless';

export const sql = neon(process.env.DATABASE_URL!);

let ready: Promise<void> | null = null;

/** Creates the tables on first use; after that it's a resolved promise per warm function. */
export function ensureSchema(): Promise<void> {
  ready ??= (async () => {
    await sql`create table if not exists profiles (
      id text primary key,
      data jsonb not null,
      updated_at bigint not null,
      deleted boolean not null default false
    )`;
    await sql`create table if not exists clips (
      id text primary key,
      name text not null,
      mime text not null,
      bytes bytea not null,
      created_at bigint not null
    )`;
    await sql`create table if not exists tables (
      code text primary key,
      key text not null,
      data jsonb not null,
      updated_at bigint not null
    )`;
    // Phones as buttons, when they can't reach the laptop directly: the host writes each phone's light here and
    // reads presses back out of the inbox.
    await sql`create table if not exists rooms (
      code text primary key,
      key text not null,
      data jsonb not null,
      updated_at bigint not null
    )`;
    await sql`create table if not exists room_inbox (
      seq bigserial primary key,
      code text not null,
      data jsonb not null,
      at bigint not null
    )`;
    await sql`create index if not exists room_inbox_code_seq on room_inbox (code, seq)`;
    // A game in progress, so a laptop that loses its browser data (or a different laptop) can pick it up.
    await sql`create table if not exists games (
      key text primary key,
      code text,
      data jsonb not null,
      updated_at bigint not null
    )`;
  })();
  return ready;
}

export const ID = /^[A-Za-z0-9-]{8,40}$/;
export const CODE = /^[A-Z0-9]{4}$/;
/** The host browser's secret: whoever holds it owns the room, the table and the saved game. */
export const KEY = /^[A-Za-z0-9-]{16,64}$/;
