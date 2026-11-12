import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'

const MIGRATIONS = join(import.meta.dirname, '../../supabase/migrations')

/** The few things Supabase provides that the migrations rely on. */
const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$
    select (nullif(current_setting('request.jwt.claims', true), '')::json ->> 'sub')::uuid
  $$;
  grant usage on schema auth to anon, authenticated;
`

/** A fresh, real Postgres in memory with the project's migrations applied. */
export async function createDb(): Promise<PGlite> {
  const db = new PGlite()
  await db.exec(SUPABASE_STUB)
  for (const file of readdirSync(MIGRATIONS).sort()) {
    await db.exec(readFileSync(join(MIGRATIONS, file), 'utf8'))
  }
  return db
}

export async function rows<T = Record<string, unknown>>(
  db: PGlite,
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  return (await db.query<T>(sql, params)).rows
}

export async function one<T = Record<string, unknown>>(
  db: PGlite,
  sql: string,
  params: unknown[] = [],
): Promise<T> {
  const result = await rows<T>(db, sql, params)
  if (result.length !== 1) throw new Error(`Expected 1 row, got ${result.length}`)
  return result[0]
}

/** Postgres returns exact decimals as text; null stays null (it is a dash, not a zero). */
export const num = (value: unknown): number | null => (value === null ? null : Number(value))

/** Run as a signed-in user, a visitor (anon), or the database owner. */
export async function actAs(db: PGlite, who: { user: string } | 'anon' | 'owner') {
  await db.exec('reset role')
  if (who === 'owner') {
    await db.exec(`select set_config('request.jwt.claims', '', false)`)
    return
  }
  if (who === 'anon') {
    await db.exec(`select set_config('request.jwt.claims', '', false); set role anon`)
    return
  }
  await db.exec(
    `select set_config('request.jwt.claims', '{"sub":"${who.user}"}', false); set role authenticated`,
  )
}

/** Expect a statement to be refused, without breaking the surrounding transaction. */
export async function refused(db: PGlite, sql: string): Promise<boolean> {
  await db.exec('savepoint attempt')
  try {
    await db.exec(sql)
    await db.exec('release savepoint attempt')
    return false
  } catch {
    await db.exec('rollback to savepoint attempt')
    return true
  }
}
