import { ArrowRight, LogIn } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Brand } from "@/components/Brand";
import { DashboardClient } from "@/components/DashboardClient";
import { getCurrentUser } from "@/lib/auth";
import { safeReturnTo } from "@/lib/http";
import { isAppConfigured } from "@/lib/env";
import { listLinearTeams } from "@/lib/linear";
import { getUserSettings } from "@/lib/settings";
import { listPokerSessions } from "@/lib/sessions";

export const dynamic = "force-dynamic";

const authErrors: Record<string, string> = {
  invalid_oauth_state: "The Linear sign-in expired. Please try again.",
  token_exchange_failed: "Linear could not complete sign-in. Please try again.",
};

export default async function AppHome({
  searchParams,
}: {
  searchParams: Promise<{ authError?: string; returnTo?: string }>;
}) {
  if (!isAppConfigured()) redirect("/setup");
  const user = await getCurrentUser();
  const { authError, returnTo } = await searchParams;
  const destination = safeReturnTo(returnTo ?? null);

  if (!user) {
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <Brand />
          <div>
            <h1>Sign in with Linear</h1>
            <p>Use your Linear account to create or join a pointing session.</p>
          </div>
          {authError && (
            <div className="form-error" role="alert">
              {Object.hasOwn(authErrors, authError) ? authErrors[authError] : "Linear sign-in could not be completed."}
            </div>
          )}
          <a
            className="button button-primary button-large"
            href={`/api/auth/linear/start?returnTo=${encodeURIComponent(destination)}`}
          >
            <LogIn size={18} /> Continue with Linear <ArrowRight size={18} />
          </a>
          <p><Link href="/privacy">Privacy and how we use your data</Link></p>
          <small>
            Read access is used to show tickets. Session facilitators also grant
            write access so the final estimate can be applied.
          </small>
          <a
            className="auth-source-link"
            href="https://github.com/jcb79107/pointed"
            rel="noreferrer"
            target="_blank"
          >
            View source on GitHub
          </a>
          <nav className="auth-discovery-links" aria-label="More about Pointed">
            <Link href="/">How Pointed works</Link>
            <Link href="/demo">Try the demo</Link>
          </nav>
        </section>
      </main>
    );
  }

  if (destination !== "/sessions") redirect(destination);

  const [teams, sessions, settings] = await Promise.all([
    listLinearTeams(user.id),
    listPokerSessions(user.id, user.organizationId),
    getUserSettings(user.id),
  ]);

  return (
    <DashboardClient
      user={{
        name: user.displayName,
        avatarUrl: user.avatarUrl,
      }}
      teams={teams}
      settings={settings}
      initialSessions={sessions.map((session) => ({
        ...session,
        updatedAt: session.updatedAt.toISOString(),
      }))}
    />
  );
}
