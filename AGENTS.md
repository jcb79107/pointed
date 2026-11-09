<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Application state transitions

Before changing session, round, queue, async UI or integration behavior, read
[the state-machine map](docs/architecture/state-machines.md). Preserve command
identity through confirmations; `STALE_ROUND` requires refresh/review, never an
automatic overwrite. Update the map and transition tests when contracts change.

## Code Review Graph

Use the project-local [Code Review Graph skill](.agents/skills/code-review-graph/SKILL.md)
for graph-backed reviews, dependency tracing, and architecture work when it narrows
source inspection. Resolve the current checkout root and prefer the available MCP
tools. Check readiness once, use minimal output, and verify graph suggestions against
source and tests. Graph maintenance requires task authorization as described in the
skill; do not launch background watchers or external embeddings implicitly.

The skill is vendored from `tirth8205/code-review-graph` at
`115dccf312b1576833bd8ead8e21dc680c8a67a5`. Its generated graph is local and gitignored.
