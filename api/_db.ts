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
  })();
  return ready;
}

export const ID = /^[A-Za-z0-9-]{8,40}$/;
