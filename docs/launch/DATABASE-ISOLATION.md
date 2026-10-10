# Database isolation

Pointed uses three database roles. Only two belong in the deployed app:

| Connection | Role | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | `pointed_runtime` | Request-scoped queries under RLS |
| `AUTH_DATABASE_URL` | `pointed_login` | Execute the verified OAuth login function only |
| `DATABASE_ADMIN_URL` | Database owner | Local migrations and recovery; never deploy |

All 14 application tables enable and force RLS. The runtime adapter rejects an
owner, superuser, or BYPASSRLS connection. Each statement/transaction receives the
SHA-256 hash of the HTTP-only session cookie through transaction-local settings.
The database resolves that hash against a valid, unexpired session. Anonymous,
invalid, and expired identities cannot read application tables.

Shared records are isolated by Linear workspace. Credentials, authentication
sessions, and personal settings are isolated by user. Application checks still
enforce room membership, Linear team access, facilitator permissions, and hidden
votes within a workspace. RLS is defense in depth, not a replacement for those
checks. A compromised application server can still access its configured secrets.

Two SECURITY DEFINER functions have deliberately narrow interfaces and pinned
search paths. `invite_preview` exposes only title, team name, status, and issue
count to a holder of a room code. `complete_login` upserts a user, encrypted Linear
credentials, and a session atomically, and is executable only by `pointed_login`.
The login connection has no direct application table privileges.

## First setup or upgrade

1. Put the database owner's connection in local `DATABASE_ADMIN_URL`. Keep the
   existing `DATABASE_URL` available until the migration finishes.
2. Install dependencies, then migrate with the environment loaded:
   `node --env-file=.env.local node_modules/drizzle-kit/bin.cjs migrate`.
   The owner must be able to create roles and functions. Migration 0008 creates
   `pointed_runtime` and `pointed_login` as NOLOGIN, NOBYPASSRLS roles. Policies
   are maintained in SQL migrations; do not replace them using schema push.
3. In a trusted owner SQL session, enable login with
   `ALTER ROLE pointed_runtime LOGIN; ALTER ROLE pointed_login LOGIN;`.
   Use psql's `\password pointed_runtime` and `\password pointed_login` prompts
   to assign separate generated passwords without putting them in shell history.
   Do not grant either role membership in an owner/admin role. Do not create
   replacement roles through a provider UI that grants BYPASSRLS.
4. Create two connection strings using the same database/host and the respective
   role names/passwords (URL-encode passwords). Set `DATABASE_URL` to runtime and
   `AUTH_DATABASE_URL` to login, locally and in each deployment environment.
   Keep `DATABASE_ADMIN_URL` only in secured operator storage/local configuration.
5. Deploy the new application. Check `/api/health`, sign-in, room creation/join,
   voting, and account removal with disposable accounts. Preview environments
   pointing at another database need their own migration and restricted roles.

## Verification and recovery

`npm test -- src/db/isolation.test.ts src/db/scoped-pool.test.ts` applies the real
migration chain in disposable PostgreSQL fixtures. It checks all-table RLS,
cross-workspace read/write denial, own-workspace access, private credentials,
login privileges, expired sessions, pooled identity reset, and error cleanup.
This does not replace a real provider OAuth or multi-user pilot.

Before rollout, test the migration in a transaction on Neon and roll it back.
Keep the previous deployment available. The migration is additive: the old
owner-backed application continues to work, allowing an application rollback
without disabling RLS. Prefer fixing restricted-role policies forward; do not
resolve deployment failures by giving the runtime role BYPASSRLS. Never copy the
owner URL into the new app configuration. Verify database restore availability
before changes to a production database.

## October 10, 2026 verification

- The additive migration was trialed on Neon in a rolled-back transaction, then
  applied through the migration ledger (nine migrations total).
- Live checks confirmed 14 protected tables, both restricted roles without
  BYPASSRLS/superuser, zero anonymous user rows, and no direct table access for
  the login role.
- A rolled-back Neon transaction created two synthetic OAuth identities and
  verified own-identity visibility and cross-workspace update denial. Synthetic
  accounts and temporary test role grants were removed by rollback.
- Local production build: 120 browser checks passed across Chromium and WebKit,
  including narrow layouts, feedback consent, cancellation, and modal shortcuts.
- Unit/integration suite: 169 tests passed; types, lint, and build passed.
- The provider token exchange is covered with mocks; this is not evidence of a
  fresh human Linear sign-in or a real two-team pilot.
