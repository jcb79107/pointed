# Sentry error reporting and feedback

The hosted Pointed app uses the personal `jason-baer/pointed` Sentry project
(project ID `4511374729019392`), separate from employer organizations.

## Configuration

- `NEXT_PUBLIC_SENTRY_DSN`: public ingestion address, configured in Vercel production and preview.
- `SENTRY_AUTH_TOKEN`: build-only secret with `org:ci`, used to upload source maps and create releases. Never expose this with a public prefix or commit it.
- `withSentryConfig` associates builds with their Git revision and removes uploaded source maps from the deployment. Without the build secret, uploads are disabled; local/CI builds still work.
- Without a DSN, reporting is disabled. Feedback displays a support fallback when unavailable.

## Data boundary

`src/lib/sentry-privacy.ts` rebuilds events from an allowlist. Automatic reports
retain code locations, release/environment, a generalized page category, and an
optional error reference. Raw error messages, request data, account data, tags,
breadcrumbs, SQL details, and frame variables are discarded. This deliberately
trades detailed exception messages for privacy; debug using source maps and the
reference. Never add ticket content or vote values to telemetry.

SDK data collection for users, cookies, headers, bodies, query parameters,
GraphQL content, database values, queue arguments, source context and local
variables is disabled. Logs and metrics are discarded; tracing and browser
session tracking are disabled. Both replay sample rates are zero. Replay starts buffering only after the user selects “Start recording to reproduce a problem.” Cancel/discard stops it without uploading. Submitting ends recording and uploads it only when “Attach my recording” is selected. No automatic restart occurs. Text is masked; forms, input controls, media, and sensitive regions are blocked. Console/network details are excluded.

Feedback includes the message, optional reply email, optional PNG/JPG/WebP screenshot (up to 5 MB), and an explicitly selected replay. The form explains these before submission. User-attached screenshots can contain private content and should be reviewed; raw page URLs are excluded from feedback metadata. No account autofill is used.

Sentry project settings disable IP storage and apply an advanced `[Remove] [Anything] from [$user.geo.**]` rule to remove inferred geography.
Feedback is stored separately from Pointed's account records. Account deletion
does not automatically delete Sentry feedback; handle requested deletion in Sentry.

## Verification and operation

- Run `npm test` for telemetry privacy regression tests and the application suites.
- Test the feedback form on `/demo` and `/support`, including a blocked request.
- Use synthetic content only for live feedback verification.
- Check production Sentry issues and source-map resolution after deployment.
- Confirm email alert receipt separately from an event appearing in Sentry.
- Roll back through Vercel if needed. Removing the DSN and redeploying disables
  reporting; revoking the build token stops future source-map uploads only.
