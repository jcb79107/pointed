# Operating Pointed

## Health and errors

`Production health` runs every 30 minutes in GitHub Actions and can be dispatched manually. It checks the landing page, demo, help, privacy, and `/api/health` (a read-only database/schema probe). GitHub schedules can be delayed; this is a basic availability check, not an SLA monitor. Enable GitHub Actions failure notifications for the repository to receive alerts; personal email/push notification delivery has not been verified.

Vercel logs contain structured `api_error` references and `health_check_failed` events, with no raw provider exception payload. Given a user-reported reference, inspect the deployment's runtime logs. Sentry is configured for filtered errors and optional feedback; see [collection boundaries and controls](SENTRY.md). Sentry email notification delivery was confirmed by the maintainer. The health probe does not detect every application-level failure. Do not copy ticket bodies, tokens, SQL parameters, or cookies into logs or public issues.

## Release

1. Land a reviewed commit through CI (unit, types, lint, dependency audit, production build, Chromium/WebKit).
2. Apply any additive migrations to the intended database with the operator-only `DATABASE_ADMIN_URL` before deploying; never deploy that owner connection as an app credential. Confirm APP_URL and target project; never print environment values.
3. Deploy the exact revision to the linked Vercel project. Record deployment ID and Git revision.
4. Run `node scripts/check-production.mjs` and the safe demo smoke checks.
5. For integrations, use a disposable Linear team/issue and two authorized accounts. Do not use employer tickets as fixtures.

## Recovery

Use the [October 10 verified baseline](DEPLOYMENT.md) when assessing a recovery target. Prefer fixing forward. Verify code, schema, and environment compatibility before any rollback; retain additive migrations through 0008 and the restricted database roles. Never replace runtime credentials with the database owner to bypass an authorization failure. Vercel rollback changes application code, not Linear estimates or database data. Older pre-patch deployments are not suitable routine recovery targets.

The September 30 [isolated restore drill](RESTORE-DRILL.md) passed for current schema/account data. The restore window observed during that drill was only 6 hours; current retention has not been reverified. Before broad public promotion, select a suitable retention window and repeat recovery with populated disposable sessions. For future drills, restore to a new isolated branch at a known timestamp. Verify migration ledger, row counts, and representative referential integrity there, then remove the disposable branch. Never overwrite production as a drill. Database credentials alone are not proof of platform restore permission. Keep the token encryption key recoverable in the existing secret manager; do not rotate it casually or copy it into this repository.

Reference: https://neon.com/docs/introduction/branch-restore

## Data deletion

Users can delete owned sessions or their account. Account deletion is authenticated, same-origin, explicitly confirmed, and transactional. It removes owned rooms and their dependent records, then the user and their credentials, auth sessions, votes and memberships. Other owners' sessions remain; foreign-key audit actors become null. Shared team defaults remain. Linear estimates are not reversed. Provider backup/log expiry is controlled separately by providers.

To handle a failed request, inspect its reference, verify state, and retry safely. Do not restore deleted personal data into the live application without reconciling deletions made since the restore point.
