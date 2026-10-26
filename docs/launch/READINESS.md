# Pointed beta readiness

Updated October 26, 2026. Pointed is preparing a security refresh and private-app parity release before inviting a small public beta group. Reddit has not been posted.

## Verified release baseline

The October 10 security release, [PR #22](https://github.com/jcb79107/pointed/pull/22), passed 169 unit/integration tests across 32 files and 120 Chromium/WebKit browser checks. Lint, types, and the Next.js 16.3.8 production build passed. The production dependency audit found no known vulnerabilities. The full audit still reported a development-only braces/micromatch chain in the Next ESLint tooling; no compatible fix was available at verification.

All 14 application tables enforce RLS. The deployed runtime and OAuth connections use restricted roles; anonymous access and cross-workspace denial were exercised with disposable, rolled-back database fixtures. See [database isolation](DATABASE-ISOLATION.md). App-level membership, facilitator permissions, and vote secrecy remain necessary alongside RLS.

A signed-out production walkthrough covered landing, demo reveal/save/next, mobile layout, sign-in entry, and feedback open/cancel. Existing-account sign-in and team listing also worked. Demo people are Richard Hendricks, Dinesh Chugtai, Gilfoyle, and facilitator Jared Dunn. Public pages, health, and OAuth start passed smoke checks.

On October 19, authenticated preview OAuth and a complete session with KEY-6904 and KEY-6905 passed: estimate 2 saved to Linear, an external estimate conflict was detected, cancel preserved the external value, and explicit overwrite saved 3. The completed summary survived refresh. Both test tickets were restored. This used one authenticated facilitator/voter, not two human accounts. Field performance and complete accessibility conformance are not established.

## Delivered safeguards

Privacy and support pages, account deletion, same-origin mutations, sanitized error references, restricted database roles, CI, scheduled availability probes, security reporting, and dependency updates are in place. Main requires a pull request and the `verify` check.

Sentry receives filtered errors and optional feedback. Recording starts only on explicit request; screenshots and recording attachments are optional. Sentry notification email delivery was confirmed by the maintainer. GitHub Actions notification delivery is a separate, unverified check. See [Sentry boundaries](SENTRY.md).

## Remaining validation

1. Run a complete session with two authorized accounts and disposable Linear issues: cycle import, reorder/remove, independent browsing, private votes, reconnect, reveal, writeback, and deletion. Repeat access checks across a second real workspace. Only the two explicitly authorized synthetic Linear tickets were changed, then restored.
2. Decide whether six-hour Neon history retention is sufficient. Retention was reverified on October 26; a populated isolated clone passed the upgrade rehearsal and a separate pre-upgrade recovery branch is retained. See the [restore drill](RESTORE-DRILL.md).
3. Observe 2–3 real teams completing a session. Jason reports weekly private-app use by his team; broader independent-team validation remains outstanding.
4. Verify GitHub failure notifications and assess performance with actual traffic before claiming field Core Web Vitals targets.

## Branding and launch URL

Current public copy and repository links use Pointed. Historical reports retain their original observations. Existing theme-storage keys remain compatible so returning users keep their preference. The public domain is `getpointed.app`; the Vercel project keeps its existing technical name. See the [domain cutover record](DOMAIN.md).

See [operations](OPERATIONS.md) and the [deployment baseline](DEPLOYMENT.md).

## October 26 security verification

- Reconciled provider-revocation checks with the current app: protected room reads, votes, actions, and realtime authorization revalidate Linear team access. Confirmed denial clears the cached room; provider outages remain retryable and do not imply revocation.
- Updated Next.js to 16.4.3, Zod to a patched 4.6 release, Vitest to 4.1.12, and Vite to a patched release. Both production and full npm audits report zero vulnerabilities.
- 289 unit/integration checks passed, including real disposable PostgreSQL RLS fixtures, provider error contracts, session access checks, and private-workspace OAuth restrictions. Lint, typecheck, and production build passed.
- Production-build browser suite: 188 passed across desktop/tablet/phone Chromium and mobile WebKit; 8 recorder tests skipped because the local build has no Sentry DSN. These are isolated browser fixtures, not live multi-account Linear evidence.
- Database migration rehearsal on an isolated populated branch preserved existing record counts; all 14 application tables enforce RLS. Detailed deployment records remain private.
- Jason reports weekly use of the private app. This is useful single-team pilot evidence, but not a claim that multiple teams or live revocation have been validated. After parity deployment, weekly use will exercise the shared release.
- Public and private Neon projects currently have six-hour history retention. Private pre-upgrade recovery is additionally retained in a branch; broader backup retention remains an operator decision.
