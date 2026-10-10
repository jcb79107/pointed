import { Pool, type PoolClient } from "@neondatabase/serverless";
import { describe, expect, it, vi } from "vitest";
import { scopedPool } from "./scoped-pool";

function fixture(bypass = false) {
  const query = vi.fn(async (q: string | {text: string}) => {
    const text = typeof q === 'string' ? q : q.text;
    if (text.startsWith('select current_user')) return {rows:[{name:'pointed_runtime',rolbypassrls:bypass,rolsuper:false}]};
    if (text === 'bad query') throw new Error('failed query');
    return {rows:[]};
  });
  const release = vi.fn();
  const pool = new Pool();
  vi.spyOn(pool, 'connect').mockImplementation((async () => ({query,release} as unknown as PoolClient)) as Pool["connect"]);
  return {query,release,pool};
}

describe('request-scoped database connections', () => {
  it('sets identity transaction-locally on every pooled query, including an anonymous request after an authenticated one', async () => {
    const f = fixture();
    const hash = vi.fn().mockResolvedValueOnce('first-user-hash').mockResolvedValueOnce('');
    const pool = scopedPool(f.pool, hash);
    await pool.query('select 1');
    await pool.query('select 2');
    expect(f.query.mock.calls.map(c=>c[0])).toEqual([
      'select current_user as name, rolbypassrls, rolsuper from pg_roles where rolname = current_user',
      'begin', "select set_config('pointed.session_hash', $1, true)", 'select 1', 'commit',
      'select current_user as name, rolbypassrls, rolsuper from pg_roles where rolname = current_user',
      'begin', "select set_config('pointed.session_hash', $1, true)", 'select 2', 'commit',
    ]);
    expect(f.query).toHaveBeenCalledWith("select set_config('pointed.session_hash', $1, true)", ['first-user-hash']);
    expect(f.query).toHaveBeenCalledWith("select set_config('pointed.session_hash', $1, true)", ['']);
    expect(f.release).toHaveBeenCalledTimes(2);
  });
  it('rolls back failed queries before releasing the connection', async () => {
    const f = fixture();
    await expect(scopedPool(f.pool, async()=> 'hash').query('bad query')).rejects.toThrow('failed query');
    expect(f.query).toHaveBeenLastCalledWith('rollback');
    expect(f.release).toHaveBeenCalledOnce();
  });
  it('establishes context after BEGIN for explicit Drizzle transactions and preserves savepoints', async () => {
    const f = fixture();
    const client = await scopedPool(f.pool, async()=> 'hash').connect();
    await client.query({text:'begin isolation level serializable'});
    await client.query('savepoint sp1');
    await client.query('rollback to savepoint sp1');
    await client.query('commit');
    client.release();
    expect(f.query).toHaveBeenNthCalledWith(3, "select set_config('pointed.session_hash', $1, true)", ['hash']);
    expect(f.query).toHaveBeenCalledWith('savepoint sp1', undefined);
    expect(f.release).toHaveBeenCalledOnce();
  });
  it('fails closed if deployment uses a bypass role', async () => {
    const f=fixture(true);
    await expect(scopedPool(f.pool, async()=> '').query('select 1')).rejects.toThrow('without RLS bypass');
    expect(f.query).toHaveBeenCalledTimes(1);
    expect(f.release).toHaveBeenCalledOnce();
  });
});

it('destroys a broken connection without hiding the original query error', async () => {
  const f = fixture();
  const original = f.query.getMockImplementation()!;
  f.query.mockImplementation(async (q) => {
    if (q === 'rollback') throw new Error('connection lost');
    return original(q);
  });
  await expect(scopedPool(f.pool, async () => '').query('bad query')).rejects.toThrow('failed query');
  expect(f.release).toHaveBeenCalledWith(true);
});

it('releases the connection when explicit transaction BEGIN fails', async () => {
  const f = fixture();
  const original = f.query.getMockImplementation()!;
  f.query.mockImplementation(async (q) => {
    if (q === 'begin') throw new Error('begin failed');
    return original(q);
  });
  const client = await scopedPool(f.pool, async () => '').connect();
  await expect(client.query('begin')).rejects.toThrow('begin failed');
  expect(f.release).toHaveBeenCalledOnce();
});
