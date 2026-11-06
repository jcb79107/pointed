# Optional session analytics

Personal Microsoft account: jasonbaer16@gmail.com. Project: Pointed (`z9kw8iheh0`),
https://clarity.microsoft.com/projects/view/z9kw8iheh0/settings.

Set `NEXT_PUBLIC_CLARITY_PROJECT_ID=z9kw8iheh0` for production and rebuild.
Leave it unset locally and in preview unless deliberately testing analytics.
There is no private API key in the client. Removing the value and rebuilding
removes the controls and integration.

`SessionAnalytics` loads the vendor script only after explicit consent. Declining
persists locally. The notice stays in document flow so it does not cover room controls.
The Privacy article exposes the choice again beside its analytics explanation. Withdrawal sends
consent denial and stops capture; it does not erase already uploaded data.
Storage failures do not grant permission. Cross-tab changes are respected.

Use Strict masking, cookies off by default, and bot filtering in the project settings.
The root body also sets `data-clarity-mask="true"`. Cookie consent grants analytics
storage only, never advertising storage. No custom user identification is sent.
Clarity still receives page addresses, device data, and masked interactions;
addresses can contain session IDs. Do not unmask ticket content or inputs.
Clarity's optional session recordings are separate from explicitly attached
Sentry feedback recordings.

Verify with synthetic content after deployment: opt in, navigate, then check
Clarity for a masked recording. Never use a real ticket as a test fixture.
Run `NEXT_PUBLIC_CLARITY_PROJECT_ID=testproject npx playwright test analytics.spec.ts`
for the mocked consent boundary check; this is not a live ingestion test.
