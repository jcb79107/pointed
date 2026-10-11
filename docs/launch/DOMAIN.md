# Moving Pointed to a custom domain

Choose and purchase a domain before changing application URLs. The existing Vercel origin remains the working production address until cutover is verified.

1. Add the chosen domain to the existing Vercel project. Use the DNS records Vercel actually returns; verify ownership and HTTPS.
2. Add the new `/api/auth/linear/callback` URL to the Linear OAuth application before changing the app. Keep the old callback during transition. If Slack is enabled, update its OAuth redirect configuration too.
3. Update `APP_URL` and `LINEAR_REDIRECT_URI` for production. Review any explicitly configured Slack redirect URI and provider allowlists. Keep preview/local settings separate. Never publish secret values.
4. Update the GitHub repository homepage, README/support/privacy links, production probe origin, and any absolute hosted links. Verify canonical metadata and social previews use the new origin.
5. Deploy through CI. Test signed-out landing/demo/privacy/support, fresh OAuth, existing-account sign-in, feedback, and a disposable room invitation on the new domain. Cookies belong to the old host, so users may need to sign in again.
6. Only after verification, configure the old public origin to redirect while preserving paths and queries. Account for outstanding OAuth callbacks and room links; do not remove old callbacks prematurely.
7. Verify health checks against the new origin and record the domain, deployment revision, and DNS configuration without credentials. If cutover fails, restore the previous app origin/provider settings and deployment; preserve database data.

Registration discounts can hide high renewals. Compare the exact name's first-year and renewal quote, including premium classification, before checkout. Availability and prices can change.
