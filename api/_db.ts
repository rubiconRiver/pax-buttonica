import { neon } from '@neondatabase/serverless';

export const sql = neon(process.env.DATABASE_URL!);

let ready: Promise<void> | null = null;

/**
 * Creates the tables on first use; after that it's a resolved promise per warm function.
 *
 * Many functions start cold at once when phones are polling, and Postgres's `create table if not exists` is not
 * safe to race: the losers fail with "duplicate key … pg_type_typname_nsp_index" even though the table is there.
 * So the whole thing runs under an advisory lock, in one transaction, and a lost race is treated as success.
 */
export function ensureSchema(): Promise<void> {
  ready ??= createSchema().catch((err: { code?: string }) => {
    if (err?.code === '23505' || err?.code === '42P07') return; // somebody else created it first: fine
    ready = null; // a real failure is retried by the next request
    throw err;
  });
  return ready;
}

async function createSchema() {
  await sql.transaction((tx) => [
    tx`select pg_advisory_xact_lock(7233661)`,
    tx`create table if not exists profiles (
      id text primary key,
      data jsonb not null,
      updated_at bigint not null,
      deleted boolean not null default false
    )`,
    tx`create table if not exists clips (
      id text primary key,
      name text not null,
      mime text not null,
      bytes bytea not null,
      created_at bigint not null
    )`,
    // The game in progress: one record per game, written by its host after every change. The code is the
    // game's name: phones, the table view and other laptops all find it by that.
    tx`create table if not exists game_states (
      code text primary key,
      host_key text not null,
      seq bigint not null default 0,
      record jsonb not null,
      updated_at bigint not null
    )`,
    tx`create index if not exists game_states_host on game_states (host_key, updated_at)`,
    // Everything that happened in a game, in order, with its time: the game can be rebuilt from these, and
    // they are what stats are made from later.
    tx`create table if not exists game_events (
      code text not null,
      i integer not null,
      at bigint not null,
      action jsonb not null,
      primary key (code, i)
    )`,
    // Presses and answers from phones, waiting for the host to read them.
    tx`create table if not exists game_actions (
      seq bigserial primary key,
      code text not null,
      data jsonb not null,
      at bigint not null
    )`,
    tx`create index if not exists game_actions_code_seq on game_actions (code, seq)`,
  ]);
}


export const ID = /^[A-Za-z0-9-]{8,40}$/;
export const CODE = /^[A-Z0-9]{4}$/;
/** The host browser's secret: whoever holds it owns the game record. */
export const KEY = /^[A-Za-z0-9-]{16,64}$/;
