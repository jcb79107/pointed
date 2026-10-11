# Pointed beta readiness

Updated October 11, 2026. Pointed is ready to invite a small beta group, with the live integration and pilot limits below made explicit.

## Verified release baseline

The October 10 security release, [PR #22](https://github.com/jcb79107/pointed/pull/22), passed 169 unit/integration tests across 32 files and 120 Chromium/WebKit browser checks. Lint, types, and the Next.js 16.3.8 production build passed. The production dependency audit found no known vulnerabilities. The full audit still reported a development-only braces/micromatch chain in the Next ESLint tooling; no compatible fix was available at verification.

All 14 application tables enforce RLS. The deployed runtime and OAuth connections use restricted roles; anonymous access and cross-workspace denial were exercised with disposable, rolled-back database fixtures. See [database isolation](DATABASE-ISOLATION.md). App-level membership, facilitator permissions, and vote secrecy remain necessary alongside RLS.

A signed-out production walkthrough covered landing, demo reveal/save/next, mobile layout, sign-in entry, and feedback open/cancel. Existing-account sign-in and team listing also worked. Demo people are Richard Hendricks, Dinesh Chugtai, Gilfoyle, and facilitator Jared Dunn. Public pages, health, and OAuth start passed smoke checks.

These checks do not prove fresh OAuth completion, live Linear writeback, field performance, or complete accessibility conformance.

## Delivered safeguards

Privacy and support pages, account deletion, same-origin mutations, sanitized error references, restricted database roles, CI, scheduled availability probes, security reporting, and dependency updates are in place. Main requires a pull request and the `verify` check.

Sentry receives filtered errors and optional feedback. Recording starts only on explicit request; screenshots and recording attachments are optional. Sentry notification email delivery was confirmed by the maintainer. GitHub Actions notification delivery is a separate, unverified check. See [Sentry boundaries](SENTRY.md).

## Remaining validation

1. Run a complete session with two authorized accounts and disposable Linear issues: cycle import, reorder/remove, independent browsing, private votes, reconnect, reveal, writeback, and deletion. Repeat access checks across a second real workspace. No employer tickets were mutated during verification.
2. Recheck backup retention and repeat recovery with populated disposable sessions. The September 30 [restore drill](RESTORE-DRILL.md) passed, but the window observed then was only six hours; current retention has not been reverified.
3. Observe 2–3 real teams completing a session. No real-team pilot evidence is claimed yet.
4. Verify GitHub failure notifications and assess performance with actual traffic before claiming field Core Web Vitals targets.

## Branding and launch URL

Current public copy and repository links use Pointed. Historical reports retain their original observations. Existing theme-storage keys remain compatible so returning users keep their preference. The public domain is `getpointed.app`; the Vercel project keeps its existing technical name. See the [domain cutover record](DOMAIN.md).

See [operations](OPERATIONS.md) and the [deployment baseline](DEPLOYMENT.md).
