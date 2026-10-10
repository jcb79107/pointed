import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, expect, it } from "vitest";
import * as schema from "./schema";

let pg: PGlite;
const tables = ['users','auth_sessions','linear_connections','user_settings','slack_connections','team_defaults','poker_sessions','queue_items','participants','rounds','round_voters','votes','round_signals','audit_events'];
const hashes = ['a'.repeat(64), 'b'.repeat(64)];
const foreignRows = new Map<string, unknown>();

beforeAll(async () => {
  pg = new PGlite();
  const db = drizzle(pg, { schema });
  await migrate(db, { migrationsFolder: 'drizzle' });
  for (const [i, tokenHash] of hashes.entries()) {
    const organizationId = `org-${i}`;
    const [user] = await db.insert(schema.users).values({ linearUserId: randomUUID(), organizationId, displayName: `User ${i}` }).returning();
    await db.insert(schema.authSessions).values({ userId: user.id, tokenHash, expiresAt: new Date(Date.now() + 3600000) });
    await db.insert(schema.linearConnections).values({ userId: user.id, encryptedAccessToken: 'ciphertext', encryptedRefreshToken: 'ciphertext', scopes: ['read'], expiresAt: new Date() });
    await db.insert(schema.userSettings).values({ userId: user.id });
    await db.insert(schema.slackConnections).values({ userId: user.id, encryptedWebhookUrl: 'ciphertext', workspaceName: 'Workspace', channelName: 'Channel', source: 'manual' });
    await pg.query("insert into team_defaults (organization_id,team_id,settings) values ($1,'team','{}')", [organizationId]);
    const [room] = await db.insert(schema.pokerSessions).values({ code: `RLS${i}`, title: 'Private', teamId: 'team', teamName: 'Team', organizationId, hostUserId: user.id, scaleType: 'linear' }).returning();
    const [ticket] = await db.insert(schema.queueItems).values({ sessionId: room.id, linearIssueId: 'issue', identifier: 'T-1', title: 'Private', url: 'https://linear.app', position: 0 }).returning();
    await db.insert(schema.participants).values({ sessionId: room.id, userId: user.id });
    const [round] = await db.insert(schema.rounds).values({ sessionId: room.id, queueItemId: ticket.id, number: 1, scaleValues: [1,2,3] }).returning();
    await db.insert(schema.roundVoters).values({ roundId: round.id, userId: user.id });
    await db.insert(schema.votes).values({ roundId: round.id, userId: user.id, value: '2' });
    await db.insert(schema.roundSignals).values({ roundId: round.id, userId: user.id, value: 'ready' });
    await db.insert(schema.auditEvents).values({ sessionId: room.id, actorUserId: user.id, eventType: 'created' });
  }
  await pg.query("insert into auth_sessions (user_id,token_hash,expires_at) select id,$1,now()-interval '1 day' from users where organization_id='org-0'", ['e'.repeat(64)]);
  await asRuntime(hashes[1], async () => {
    for (const table of tables) {
      const { rows } = await pg.query<{row: unknown}>(`select to_jsonb(t) as row from ${table} t`);
      foreignRows.set(table, rows[0].row);
    }
  });
}, 30000);
afterAll(async () => { await pg.close(); });

async function asRuntime(hash: string, run: () => Promise<void>) {
  await pg.exec('begin; set local role pointed_runtime');
  try { await pg.query("select set_config('pointed.session_hash',$1,true)", [hash]); await run(); }
  finally { await pg.exec('rollback'); }
}

it('enables and forces RLS on all 14 tables; runtime and login cannot bypass it', async () => {
  const {rows} = await pg.query<{relrowsecurity: boolean; relforcerowsecurity: boolean}>("select relrowsecurity,relforcerowsecurity from pg_class join pg_namespace n on n.oid=relnamespace where n.nspname='public' and relkind='r'");
  expect(rows).toHaveLength(14);
  expect(rows.every(r=>r.relrowsecurity && r.relforcerowsecurity)).toBe(true);
  expect((await pg.query("select rolbypassrls,rolsuper from pg_roles where rolname in ('pointed_runtime','pointed_login')")).rows).toEqual([{rolbypassrls:false,rolsuper:false},{rolbypassrls:false,rolsuper:false}]);
});

for (const hash of ['', 'invalid', 'e'.repeat(64)]) it(`denies all table reads for ${hash ? 'invalid/expired' : 'anonymous'} identity`, async () => {
  await asRuntime(hash, async () => { for (const table of tables) expect((await pg.query(`select * from ${table}`)).rows, table).toHaveLength(0); });
});

for (const [i, hash] of hashes.entries()) it(`workspace ${i} can see only its own data across every table`, async () => {
  await asRuntime(hash, async () => {
    for (const table of tables) expect((await pg.query(`select * from ${table}`)).rows, table).toHaveLength(table === 'auth_sessions' && i === 0 ? 2 : 1);
  });
});

for (const table of tables) it(`denies cross-workspace reads, updates, deletes, and inserts on ${table}`, async () => {
  const row = JSON.stringify(foreignRows.get(table));
  await asRuntime(hashes[0], async () => {
    expect((await pg.query(`select * from ${table} t where to_jsonb(t)=$1::jsonb`, [row])).rows).toHaveLength(0);
    expect((await pg.query(`delete from ${table} t where to_jsonb(t)=$1::jsonb returning *`, [row])).rows).toHaveLength(0);
    const column = Object.keys(foreignRows.get(table) as object)[0];
    expect((await pg.query(`update ${table} t set "${column}"="${column}" where to_jsonb(t)=$1::jsonb returning *`, [row])).rows).toHaveLength(0);
    await expect(pg.query(`insert into ${table} select * from json_populate_record(null::${table}, $1::json)`, [row])).rejects.toMatchObject({code:'42501'});
  });
});

it('exposes only the documented invitation metadata to an anonymous visitor', async () => {
  await asRuntime('', async () => {
    expect((await pg.query("select * from pointed_private.invite_preview('RLS1')")).rows).toEqual([{title:'Private',teamName:'Team',status:'draft',issueCount:1}]);
    expect((await pg.query("select * from pointed_private.invite_preview('unknown')")).rows).toEqual([]);
  });
});

it('login role can provision a verified login but cannot read application tables', async () => {
  await pg.exec('begin; set local role pointed_login');
  try {
    await pg.query("select pointed_private.complete_login('new-linear','new-org','a@example.test','New',null,'encrypted','encrypted',array['read'],now()+interval '1 hour',$1,now()+interval '14 days')", ['c'.repeat(64)]);
    await expect(pg.query('select * from users')).rejects.toMatchObject({code:'42501'});
  } finally { await pg.exec('rollback'); }
});

it('runtime role cannot invoke the privileged login function', async () => {
  await asRuntime(hashes[0], async () => {
    await expect(pg.query("select pointed_private.complete_login('x','x','x','x',null,'x','x',array['read'],now(),$1,now()+interval '1 day')", ['c'.repeat(64)])).rejects.toMatchObject({code:'42501'});
  });
});

it('private credentials remain hidden from another user in the same workspace', async () => {
  const db = drizzle(pg, {schema});
  const [peer] = await db.insert(schema.users).values({linearUserId:randomUUID(),organizationId:'org-0',displayName:'Peer'}).returning();
  await db.insert(schema.authSessions).values({userId:peer.id,tokenHash:'d'.repeat(64),expiresAt:new Date(Date.now()+3600000)});
  await asRuntime('d'.repeat(64), async () => {
    for (const table of ['linear_connections','slack_connections','user_settings']) expect((await pg.query(`select * from ${table}`)).rows).toHaveLength(0);
    expect((await pg.query('select * from auth_sessions')).rows).toHaveLength(1);
  });
});

it('allows the session lifecycle and account deletion under the restricted role', async () => {
  await asRuntime(hashes[0], async () => {
    const db = drizzle(pg, { schema });
    const identity = (await pg.query<{user_id: string}>("select user_id from pointed_private.identity()")).rows[0];
    const user = (await db.select().from(schema.users)).find(row => row.id === identity.user_id)!;
    const [room] = await db.insert(schema.pokerSessions).values({ code: 'NORMAL', title: 'Normal session', teamId: 'team', teamName: 'Team', organizationId: user.organizationId, hostUserId: user.id, scaleType: 'linear' }).returning();
    const [ticket] = await db.insert(schema.queueItems).values({ sessionId: room.id, linearIssueId: 'normal', identifier: 'T-2', title: 'Normal', url: 'https://linear.app', position: 0 }).returning();
    await db.insert(schema.participants).values({ sessionId: room.id, userId: user.id });
    const [round] = await db.insert(schema.rounds).values({ sessionId: room.id, queueItemId: ticket.id, number: 1, scaleValues: [1,2,3] }).returning();
    await db.insert(schema.roundVoters).values({ roundId: round.id, userId: user.id });
    await db.insert(schema.votes).values({ roundId: round.id, userId: user.id, value: '2' });
    await db.insert(schema.auditEvents).values({ sessionId: room.id, actorUserId: user.id, eventType: 'created' });
    expect((await pg.query('update rounds set revealed_at=now() where id=$1 returning id', [round.id])).rows).toHaveLength(1);
    expect((await pg.query('delete from poker_sessions where host_user_id=$1 returning id', [user.id])).rows.length).toBeGreaterThan(0);
    expect((await pg.query('delete from users where id=$1 returning id', [user.id])).rows).toHaveLength(1);
    for (const table of ['auth_sessions','linear_connections','participants','votes']) expect((await pg.query(`select * from ${table}`)).rows).toHaveLength(0);
  });
});
