# UI audit fixes — November 9, 2026

Implements the 12 findings from the authenticated production audit. Production screenshots remain outside Git because they contain private workspace content. Browser regressions use synthetic fixtures and mocked provider boundaries.

| Finding | Change | Regression evidence |
|---|---|---|
| 1. Mobile header crowding | Labeled Actions disclosure; title wraps independently; destructive action separated; Escape returns focus | `audit-improvements`, `room-responsive`, `demo` |
| 2. Long issues hide voting | Sticky mobile jump control moves focus to the existing vote dock, without duplicating actions or changing desktop panes | `audit-improvements`, `room-responsive` |
| 3. Unnamed ticket search | Visible label and associated filter description | `audit-improvements` (including axe) |
| 4. Misleading waiting/timer | Derive Waiting for voters from round eligibility; label ticket/session elapsed time and explain waiting; Join voting uses existing participant-role command | `audit-improvements`, existing demo timer and role tests |
| 5. Summary title overflow | Shrink text container, wrap long titles and unbroken identifiers | `audit-boundaries`, `session-ui-regressions` |
| 6. Invite clipping | Remove conflicting mobile button margin; wrap the empty-room layout | `audit-improvements` geometry assertion |
| 7. Empty preparation | Compact empty panel and an associated disabled-start explanation; explain the invite waiting room | `audit-improvements`, `cycle-preview` |
| 8. Lost draft identity | Display session title in preparation | `audit-improvements` |
| 9. Disconnected Slack | Read connection to show Set up Slack; refresh destination before confirmation; explain webhook-only deployment; separate notices from toolbar layout | `audit-boundaries`, provider route/unit tests |
| 10. Feedback validation | Inline associated message error and focus; expand/focus invalid optional email; sticky dialog actions; preserve drafts | `audit-improvements`, `feedback` |
| 11. Hidden ticket filters | Display actual team, cycle, states, estimate, assignee and already-queued constraints; link to missing-ticket guidance | `audit-improvements` |
| 12. Workspace navigation | Explicit Brand destination at authenticated callers, public default unchanged; Help links directly to sessions | `audit-improvements`, `audit-boundaries`, public route tests |

## Compatibility and review

No database migrations, package additions, endpoint changes, provider-write changes, timing persistence changes, or vote-privacy changes are part of these UI fixes. The earlier stale-round protection in this worktree remains intact. A presentation-only waiting state does not end a session or change elapsed data. Join voting sends the same facilitator-role payload as the existing role selector. The mobile disclosure contains the existing controls, so their confirmations and error handling are preserved.

Code Review Graph MCP was used against this checkout with a matching HEAD (`9b7ac0b`). Importer and change-impact queries identified shared Brand, Slack, and LiveRoom callers as review priorities. Its high-risk score also includes the earlier uncommitted finalization work. Graph-inferred test gaps are not coverage measurements; source inspection and the named integration/browser tests are the verification evidence. New untracked tests are not represented by the existing index. No external embeddings or watcher were started.

## Rollout and recovery

These changes are local and have not been deployed. Rollback is a code revert; no stored data conversion is involved. On deployment, smoke-check mobile voting navigation, empty waiting state, Slack setup/confirmation, feedback validation, and a long-title summary. Keep normal integration error monitoring; do not record ticket descriptions or feedback contents in new logs.

Verification results are recorded below after final checks. Real Linear writes, Slack delivery, OAuth grants, physical-device keyboards, and manual screen-reader testing remain outside the isolated test suite. Automated accessibility checks are not a WCAG certification.

## Final verification

- `npm test`: **298 passed**, 39 files.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run build -- --webpack`: passed with isolated synthetic integration configuration.
- `UI_TEST_PRODUCTION=1 NEXT_PUBLIC_CLARITY_PROJECT_ID=uitest FEEDBACK_RECORDING_TEST=1 npm run test:ui`: **248 passed**, no skips, across desktop, tablet, phone, and WebKit. The matching build used the same synthetic Clarity ID and a `sentry.invalid` DSN; integration requests were intercepted. Do not use this test configuration for a deployment.
- `git diff --check`: passed.
- Manually inspected the production-build demo in Chrome at desktop and 390px, including action disclosure, jump-to-voting focus, empty feedback submission, cancel/focus return, and screenshots. Inspected saved synthetic long-summary, empty-voter, and ticket-search captures. Automated reflow checks also cover 320px and short landscape windows.

The first development-server run exposed a leftover mobile button margin and dark-theme contrast failure; both were fixed. New snapshot tests now begin with explicit synthetic scenarios instead of racing the five-second poll. A production-build run removed intermittent development-server JSON errors. The initial analytics test ID contained a disallowed hyphen; after correcting the synthetic configuration, the complete final 248-test run passed without retries.

Local screenshots and the final HTML report are saved outside Git in
`/Users/jason/Developer/pointed-ui-fixes-2026-11-09/`.
No production data, real Linear estimate, Slack message, or user feedback was changed.
