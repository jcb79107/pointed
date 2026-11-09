import { LiveRoom } from "@/components/LiveRoom";
import { QueueBuilder } from "@/components/QueueBuilder";
import { SettingsClient } from "@/components/SettingsClient";
import { DashboardClient } from "@/components/DashboardClient";
import { DEFAULT_TEAM_DEFAULTS } from "@/lib/team-defaults";
// Copied into the isolated harness; fixture data never ships in the application.
// @ts-expect-error Only resolved inside the generated fixture app.
import { demoSnapshot } from "@/fixture";
import type { SessionSnapshot } from "@/lib/domain";
export default async function Fixture({
  searchParams,
}: {
  searchParams: Promise<{ screen?: string; scenario?: string }>;
}) {
  const { screen, scenario } = await searchParams;
  const room: SessionSnapshot = structuredClone(demoSnapshot);
  if (scenario === "long") {
    room.title = "A long session name that must remain readable";
    room.queue[0].description = "Long issue context.\n\n".repeat(90);
  }
  if (scenario === "waiting") {
    room.participants = room.participants.filter(p => p.id === room.currentUserId);
    room.participants[0].votingEnabled = false;
    room.round!.eligibleVoterIds = [];
    room.queue[0].elapsedSeconds = 59 * 3600;
  }
  const draft: SessionSnapshot = {
    ...demoSnapshot,
    status: "draft",
    activeItemId: null,
    round: null,
    defaults: DEFAULT_TEAM_DEFAULTS,
    queue: [],
  };
  const teams = ["team-a", "team-b"].map((id, index) => ({
    id,
    key: "API",
    name: index === 0 ? "Platform API" : "Product",
    issueEstimationType: "linear" as const,
    issueEstimationAllowZero: true,
    issueEstimationExtended: false,
  }));
  return (
    <>
      <aside aria-label="Preview environment" className="fixture-banner">
        Local preview · Synthetic tickets and accounts
      </aside>
      {screen === "dashboard" ? (
        <DashboardClient
          user={{ name: "Richard Hendricks", avatarUrl: null }}
          teams={teams}
          initialSessions={["2026-10-14T01:30:00Z", "2026-10-14T23:30:00Z"].map((updatedAt, index) => ({
            id: `session-${index}`, code: `demo-${index}`, title: `Timezone session ${index + 1}`,
            teamName: "Platform API", status: "draft", updatedAt,
            activeQueueItemId: null, issueCount: 0,
          }))}
        />
      ) : screen === "live" || screen === "room" ? (
        <LiveRoom initialSnapshot={room} />
      ) : screen === "settings" ? (
        <SettingsClient
          user={{ name: "Richard Hendricks", email: "richard@example.test" }}
          teams={teams}
          initialDefaults={{
            "team-a": DEFAULT_TEAM_DEFAULTS,
            "team-b": DEFAULT_TEAM_DEFAULTS,
          }}
          hasWriteScope={false}
        />
      ) : (
        <QueueBuilder
          initialSnapshot={draft}
          settings={DEFAULT_TEAM_DEFAULTS}
        />
      )}
    </>
  );
}
