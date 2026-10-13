import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq } from "drizzle-orm";
import {
  beforeAll,
  afterAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import * as schema from "@/db/schema";
import type { LinearIssueSummary, SessionIntake } from "./domain";
import { DEFAULT_TEAM_DEFAULTS, teamDefaultsSchema } from "./team-defaults";
import { resolveCycleOffset } from "./linear-order";
const mocks = vi.hoisted(() => ({
  db: undefined as PgliteDatabase<typeof schema> | undefined,
  access: vi.fn(),
  resolve: vi.fn(),
  issues: vi.fn(),
  getIssue: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({
  get db() {
    return mocks.db;
  },
}));
vi.mock("@/lib/linear", () => ({
  userHasTeamAccess: mocks.access,
  resolveSessionIntake: mocks.resolve,
  loadIntakeIssues: mocks.issues,
  getLinearIssue: mocks.getIssue,
  updateLinearIssueEstimate: vi.fn(),
}));
vi.mock("@/lib/realtime", () => ({ broadcastSessionChanged: vi.fn() }));
import { getTeamDefaults, saveTeamDefaults } from "./team-settings";
import { createPokerSession, getSessionSnapshot, startPokerSession, castVote, revealRound, finalizeEstimate } from "./sessions";
import { loadSessionAgenda, updateDraftDefaults } from "./session-intake";
let client: PGlite;
const db = () => mocks.db!;
const team = {
  id: "team",
  key: "T",
  name: "Team",
  issueEstimationType: "linear" as const,
  issueEstimationAllowZero: true,
  issueEstimationExtended: false,
};
const intake: SessionIntake = {
  cycleOffset: 1,
  cycleId: "cycle-next",
  name: "Cycle 20",
  startsAt: "2026-10-01T00:00:00Z",
  endsAt: "2026-10-15T00:00:00Z",
};
function issue(
  id: string,
  sortOrder: number,
  priority = 0,
): LinearIssueSummary {
  return {
    id,
    identifier: `T-${id}`,
    title: `Ticket ${id}`,
    description: "Ready to point",
    url: "https://linear.app",
    priorityLabel: "High",
    priority,
    sortOrder,
    stateName: "Todo",
    stateType: "unstarted",
    assigneeName: null,
    assigneeId: null,
    projectName: null,
    labels: [],
    subIssues: [],
    attachments: [],
    estimate: null,
    teamId: team.id,
    createdAt: "2026-08-01T00:00:00Z",
    updatedAt: "2026-09-01T00:00:00Z",
    dueDate: null,
  };
}
async function actor(organizationId: string = randomUUID()) {
  const [user] = await db()
    .insert(schema.users)
    .values({
      organizationId,
      linearUserId: randomUUID(),
      displayName: "Fixture",
    })
    .returning();
  return user;
}
async function draft(userId: string, organizationId: string) {
  return createPokerSession({
    userId,
    organizationId,
    title: "Cycle preview",
    team,
    pointingCards: [
      { value: 0, label: "0" },
      { value: 1, label: "1" },
    ],
    autoReveal: true,
    defaults: DEFAULT_TEAM_DEFAULTS,
  });
}
beforeAll(async () => {
  client = new PGlite();
  mocks.db = drizzle(client, { schema });
  await migrate(db(), { migrationsFolder: "drizzle" });
}, 30000);
afterAll(async () => {
  await client.close();
});
beforeEach(() => {
  mocks.getIssue.mockReset().mockResolvedValue(issue("1", 10));
  mocks.access.mockReset().mockResolvedValue(true);
  mocks.resolve.mockReset().mockResolvedValue(intake);
  mocks.issues.mockReset().mockResolvedValue([issue("2", 20), issue("1", 10)]);
});

describe("relative cycles", () => {
  const cycles = [0, 1, 2, 3].map((n) => ({
    id: `${n}`,
    startsAt: new Date(Date.UTC(2026, 9, 1 + n * 7)),
    endsAt: new Date(Date.UTC(2026, 9, 8 + n * 7)),
  }));
  it("resolves current and future cycles, including rollover and missing cycles", () => {
    const now = new Date("2026-10-02T00:00:00Z");
    expect(
      [0, 1, 2, 3].map(
        (n) => resolveCycleOffset(cycles, n as 0 | 1 | 2 | 3, now)?.id,
      ),
    ).toEqual(["0", "1", "2", "3"]);
    expect(
      resolveCycleOffset(cycles, 1, new Date("2026-10-08T00:00:00Z"))?.id,
    ).toBe("2");
    expect(
      resolveCycleOffset(cycles, 3, new Date("2026-10-08T00:00:00Z")),
    ).toBeNull();
    expect(resolveCycleOffset([], 0, now)).toBeNull();
  });
  it("counts scheduled cycles across cooldown gaps rather than calendar weeks", () => {
    expect(
      resolveCycleOffset(
        [cycles[0], cycles[2]],
        1,
        new Date("2026-10-10T00:00:00Z"),
      )?.id,
    ).toBe("2");
  });
  it("rejects invalid preference contracts", () => {
    expect(
      teamDefaultsSchema.safeParse({
        ...DEFAULT_TEAM_DEFAULTS,
        cycleOffset: -1,
      }).success,
    ).toBe(false);
    expect(
      teamDefaultsSchema.safeParse({
        ...DEFAULT_TEAM_DEFAULTS,
        defaultSort: "random",
      }).success,
    ).toBe(false);
  });
});

describe("shared defaults and draft persistence", () => {
  it("shares defaults within a team, isolates workspaces and denies inaccessible teams", async () => {
    const first = await actor();
    const colleague = await actor(first.organizationId);
    const otherOrg = await actor();
    const settings = {
      ...DEFAULT_TEAM_DEFAULTS,
      cycleOffset: 2 as const,
      facilitatorVotes: true,
      autoReveal: false,
    };
    await saveTeamDefaults(first, team.id, settings);
    expect(await getTeamDefaults(colleague, team.id)).toEqual(settings);
    expect(await getTeamDefaults(otherOrg, team.id)).toEqual(
      DEFAULT_TEAM_DEFAULTS,
    );
    expect(await getTeamDefaults(first, "another-team")).toEqual(
      DEFAULT_TEAM_DEFAULTS,
    );
    mocks.access.mockResolvedValue(false);
    await expect(
      saveTeamDefaults(first, team.id, DEFAULT_TEAM_DEFAULTS),
    ).rejects.toThrow("FORBIDDEN");
    await expect(getTeamDefaults(first, team.id)).rejects.toThrow("FORBIDDEN");
  });
  it("pins a cycle, orders all imported tickets, and retains the pin on reload", async () => {
    const user = await actor();
    const session = await draft(user.id, user.organizationId);
    await loadSessionAgenda(session.id, user.id, DEFAULT_TEAM_DEFAULTS);
    let snapshot = await getSessionSnapshot(session.id, user.id);
    expect(snapshot.queue.map((q) => q.linearIssueId)).toEqual(["1", "2"]);
    expect(snapshot.intake).toEqual(intake);
    mocks.resolve.mockClear();
    await loadSessionAgenda(session.id, user.id, DEFAULT_TEAM_DEFAULTS);
    expect(mocks.resolve).not.toHaveBeenCalled();
    expect(mocks.issues).toHaveBeenLastCalledWith(user.id, team.id, intake);
    snapshot = await getSessionSnapshot(session.id, user.id);
    expect(snapshot.queue).toHaveLength(2);
    await updateDraftDefaults(session.id, user.id, {
      ...DEFAULT_TEAM_DEFAULTS,
      autoReveal: false,
      facilitatorVotes: true,
    });
    snapshot = await getSessionSnapshot(session.id, user.id);
    expect(snapshot.autoReveal).toBe(false);
    expect(snapshot.participants[0].votingEnabled).toBe(true);
    await expect(
      updateDraftDefaults(session.id, user.id, {
        ...DEFAULT_TEAM_DEFAULTS,
        cycleOffset: 3,
      }),
    ).rejects.toThrow("Load the selected cycle");
  });
  it("preserves the agenda on Linear errors, rejects nonfacilitators and live replacement", async () => {
    const user = await actor();
    const outsider = await actor();
    const session = await draft(user.id, user.organizationId);
    await loadSessionAgenda(session.id, user.id, DEFAULT_TEAM_DEFAULTS);
    const before = (await getSessionSnapshot(session.id, user.id)).queue;
    mocks.issues.mockRejectedValue(new Error("Linear unavailable"));
    await expect(
      loadSessionAgenda(session.id, user.id, DEFAULT_TEAM_DEFAULTS),
    ).rejects.toThrow("Linear unavailable");
    expect((await getSessionSnapshot(session.id, user.id)).queue).toEqual(
      before,
    );
    await expect(
      loadSessionAgenda(session.id, outsider.id, DEFAULT_TEAM_DEFAULTS),
    ).rejects.toThrow("FORBIDDEN");
    await db()
      .insert(schema.participants)
      .values({
        sessionId: session.id,
        userId: outsider.id,
        role: "voter",
        votingEnabled: true,
      });
    await expect(
      updateDraftDefaults(session.id, outsider.id, DEFAULT_TEAM_DEFAULTS),
    ).rejects.toThrow("FORBIDDEN");
    await db()
      .update(schema.pokerSessions)
      .set({ status: "live" })
      .where(eq(schema.pokerSessions.id, session.id));
    await expect(
      loadSessionAgenda(session.id, user.id, DEFAULT_TEAM_DEFAULTS),
    ).rejects.toThrow("Only draft");
  });
  it("supports backlog and priority without mutating team defaults", async () => {
    const user = await actor();
    const session = await draft(user.id, user.organizationId);
    mocks.resolve.mockResolvedValue({
      cycleOffset: "backlog",
      cycleId: null,
      name: "Backlog / no cycle",
      startsAt: null,
      endsAt: null,
    });
    mocks.issues.mockResolvedValue([issue("1", 10, 0), issue("2", 20, 1)]);
    await loadSessionAgenda(session.id, user.id, {
      ...DEFAULT_TEAM_DEFAULTS,
      cycleOffset: "backlog",
      defaultSort: "priority",
    });
    const snapshot = await getSessionSnapshot(session.id, user.id);
    expect(snapshot.queue.map((item) => item.linearIssueId)).toEqual([
      "2",
      "1",
    ]);
    expect(snapshot.intake?.cycleId).toBeNull();
    expect(await getTeamDefaults(user, team.id)).toEqual(DEFAULT_TEAM_DEFAULTS);
  });
});

it("does not import zero-point, completed, or canceled tickets even if the remote response contains them", async () => {
  const user = await actor(); const session = await draft(user.id, user.organizationId);
  mocks.issues.mockResolvedValue([
    issue("ready", 10),
    { ...issue("zero", 20), estimate: 0 },
    { ...issue("done", 30), stateType: "completed" },
    { ...issue("canceled", 40), stateType: "canceled" },
    { ...issue("triage", 50), stateType: "triage" },
  ]);
  await loadSessionAgenda(session.id, user.id, DEFAULT_TEAM_DEFAULTS);
  expect((await getSessionSnapshot(session.id, user.id)).queue.map(item => item.linearIssueId)).toEqual(["ready", "triage"]);
});

it("refuses a stale import when the session changes during the Linear read", async () => {
  const user = await actor(); const session = await draft(user.id, user.organizationId);
  await loadSessionAgenda(session.id, user.id, DEFAULT_TEAM_DEFAULTS);
  const before = (await getSessionSnapshot(session.id, user.id)).queue;
  mocks.issues.mockImplementationOnce(async () => {
    await db().update(schema.pokerSessions).set({ updatedAt: new Date(Date.now() + 1000) }).where(eq(schema.pokerSessions.id, session.id));
    return [issue("new", 99)];
  });
  await expect(loadSessionAgenda(session.id, user.id, DEFAULT_TEAM_DEFAULTS)).rejects.toThrow("agenda changed");
  expect((await getSessionSnapshot(session.id, user.id)).queue).toEqual(before);
});


it("excludes zero in new and existing real rooms and rejects legacy zero submissions", async () => {
  const user = await actor();
  const session = await draft(user.id, user.organizationId);
  expect(session.pointingCards).toEqual([{ value: 1, label: "1" }]);
  const legacyCards = [{ value: 0, label: "0" }, { value: 1, label: "1" }];
  await db().update(schema.pokerSessions).set({ pointingCards: legacyCards }).where(eq(schema.pokerSessions.id, session.id));
  await loadSessionAgenda(session.id, user.id, DEFAULT_TEAM_DEFAULTS);
  await db().update(schema.participants).set({ votingEnabled: true }).where(eq(schema.participants.sessionId, session.id));
  await startPokerSession(session.id, user.id);
  const snapshot = await getSessionSnapshot(session.id, user.id);
  expect(snapshot.estimateCards).toEqual([{ value: 1, label: "1" }]);
  expect(snapshot.elapsedSeconds).toBe(0);
  expect(snapshot.queue.find(item => item.id === snapshot.activeItemId)?.elapsedSeconds).toBe(0);
  await db().update(schema.rounds).set({ scaleValues: [0, 1] }).where(eq(schema.rounds.id, snapshot.round!.id));
  await expect(castVote({ sessionId: session.id, userId: user.id, value: 0 })).rejects.toThrow("Vote must be one of: 1");
  await castVote({ sessionId: session.id, userId: user.id, value: 1 });
  await revealRound(session.id, user.id);
  await expect(finalizeEstimate({ sessionId: session.id, userId: user.id, estimate: 0 })).rejects.toThrow("Final estimate must be one of: 1");
});
