# Verified deployment baseline — October 10, 2026

This records the security release baseline, not a permanently current deployment ID. Later maintenance releases are tracked by their GitHub PR checks and Vercel deployment status.

- Production alias: https://public-linear-pointing.vercel.app/
- Immutable deployment: https://public-linear-pointing-aat7z3qu0-jcb79107s-projects.vercel.app
- Vercel ID: `dpl_5jocW5G7vs74XDgAgkLc9QZedGve`
- Revision: `6dbc5b46de63e23fb13a8082042dc55b014b6085`
- Release: [PR #22](https://github.com/jcb79107/pointed/pull/22)
- Required CI: [run 38072657506](https://github.com/jcb79107/pointed/actions/runs/38072657506)
- Next.js 16.3.8; nine migrations, through 0008; restricted runtime and OAuth database roles.

## Evidence

169 unit/integration tests across 32 files and 120 browser checks passed, along with lint, types, production build, and production dependency audit. Browser coverage uses the demo and isolated fixtures; it is not live Linear writeback evidence.

Production probes passed for landing, demo, privacy, support, database health, and OAuth start. A subsequent signed-out walkthrough exercised demo reveal/save/next and mobile layout without page errors. Existing authenticated dashboard/team listing worked. Database checks verified restricted roles and cross-workspace denial with rolled-back fixtures.

Sentry error and feedback ingestion and notification delivery have been verified. Recording is opt-in; see [data boundaries](SENTRY.md). See [readiness](READINESS.md) for live integration, recovery, and real-team pilot limits.

## Maintenance releases

Merge through the required `verify` check, let the linked Vercel project deploy the merged revision, and inspect the deployment before probing the production alias. Do not assume a successful merge means the alias has switched. No database migration is needed for the October 11 branding/documentation cleanup.
