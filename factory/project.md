# Project context

Every factory agent reads this file first. Only the orchestrator writes it: it
fills it in on `/factory:init`, re-checks it at the start of each job, and
refreshes it after each merge.

## Repo
- Base: `main`, or the local target branch when it already contains the base
  (local merges not pushed yet). Every job's worktree starts there.
- Merge target: `main` (local, not pushed)
- Language / stack: plain JavaScript ES modules, HTML, CSS. Browser only, no build step, no dependencies (see `factory/product.md`)
- Install: `none` (no dependencies). Run it once in each new worktree.
- Test command: `node --test` (Node v24; tests cover pure logic; one test needs `python3` on PATH)
- Start: `python3 -m http.server 8000 --bind 127.0.0.1`, then open http://localhost:8000/
- Lint / format: `none yet`

## Sources
- GitHub issues: none (no `origin` remote)
- Jira: none

## Conventions
- UI: responsive design (mobile phone portrait up to desktop; table and cards must fit and be tappable on a small screen). Make it pretty and a bit playful: warm colors, friendly rounded shapes, small lively touches (hover/tap feedback, gentle transitions), while keeping it readable and accessible (contrast, focus states, `prefers-reduced-motion`).
- UI language: German. Code, comments, commits: English, Conventional Commits.

## Factory rules
- Product code never goes into `factory/` or `.claude/`.
- One job = one branch `factory/<job-id>` in its own worktree
  `.claude/worktrees/factory-<job-id>`, created from the base ref.
- Smallest complete change. A known limit gets a `shortcut: <limit>, <when to upgrade>` comment.
