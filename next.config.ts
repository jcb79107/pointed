import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const nextConfig: NextConfig = {
  redirects() {
    return [
      ...["public-linear-pointing.vercel.app", "www.getpointed.app"].map((host) => ({
        source: "/:path*",
        has: [{ type: "host" as const, value: host.replaceAll(".", "\\.") }],
        destination: "https://getpointed.app/:path*",
        // Keep cutover reversible while the beta settles in.
        permanent: false,
      })),
      { source: "/app", destination: "/sessions", permanent: true },
      { source: "/app/settings", destination: "/settings", permanent: true },
      { source: "/app/account", destination: "/account", permanent: true },
      { source: "/app/sessions/:path*", destination: "/sessions/:path*", permanent: true },
    ];
  },
  turbopack: {
    root: process.cwd(),
  },
};

export default withSentryConfig(nextConfig, {
  org: "jason-baer",
  project: "pointed",
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  telemetry: false,
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
    deleteSourcemapsAfterUpload: true,
  },
});
