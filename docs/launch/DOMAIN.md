# Pointed custom domain

`https://getpointed.app` is the selected public origin. DNS remains at Porkbun. Vercel verified the apex records on October 11, 2026:

- `A @ 216.198.79.1`
- `A @ 64.29.17.1`
- `CNAME www f327c0e4ce35d215.vercel-dns-017.com`
- TTL: 600 seconds. These are this project’s returned records, not universal Vercel defaults.

After deploying this cutover, the application redirects the old public Vercel hostname and `www` to the apex with a reversible 307, preserving paths and queries. Other deployment/preview hosts remain accessible. Users must sign in again because cookies are host-bound. An OAuth flow begun on the old host during cutover must be restarted on the new host; do not copy authentication cookies or codes between domains.

## Cutover and future domain changes

On October 13, 2026, the existing production Linear OAuth app was renamed Pointed and its homepage changed to `https://getpointed.app`. The new callback was registered alongside the old callback. Production `APP_URL` and `LINEAR_REDIRECT_URI` were updated for the next deployment. OAuth scopes and credentials are unchanged. The following checklist also applies to future domain changes.

1. Add the chosen domain to the existing Vercel project. Use the DNS records Vercel actually returns; verify ownership and HTTPS.
2. Add the new `/api/auth/linear/callback` URL to the Linear OAuth application before changing the app. Keep the old callback during transition. If Slack is enabled, update its OAuth redirect configuration too.
3. Update `APP_URL` and `LINEAR_REDIRECT_URI` for production. Review any explicitly configured Slack redirect URI and provider allowlists. Keep preview/local settings separate. Never publish secret values.
4. Update the GitHub repository homepage, README/support/privacy links, production probe origin, and any absolute hosted links. Verify canonical metadata and social previews use the new origin.
5. Deploy through CI. Test signed-out landing/demo/privacy/support, fresh OAuth, existing-account sign-in, feedback, and a disposable room invitation on the new domain. Cookies belong to the old host, so users may need to sign in again.
6. Only after verification, configure the old public origin to redirect while preserving paths and queries. Account for outstanding OAuth callbacks and room links; do not remove old callbacks prematurely.
7. Verify health checks against the new origin and record the domain, deployment revision, and DNS configuration without credentials. If cutover fails, restore the previous app origin/provider settings and deployment; preserve database data.

Registration discounts can hide high renewals. Compare the exact name's first-year and renewal quote, including premium classification, before checkout. Availability and prices can change.
