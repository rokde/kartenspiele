# Project context

Every factory agent reads this file first. Only the orchestrator writes it: it
fills it in on `/factory:init`, re-checks it at the start of each job, and
refreshes it after each merge.

## Repo
- Base: `origin/main`, or the local target branch when it already contains the base
  (local merges not pushed yet). Every job's worktree starts there.
- Merge target: `main` (local, not pushed)
- Language / stack: plain JavaScript ES modules, HTML, CSS. Browser only, no build step, no dependencies (see `factory/product.md`)
- Install: `none` (no dependencies). Run it once in each new worktree.
- Test command: `node --test` (Node v24; tests cover pure logic; one test needs `python3` on PATH)
- Start: `python3 -m http.server 8000 --bind 127.0.0.1`, then open http://localhost:8000/
- Browser check: `playwright-cli` (global, `@playwright/cli`) is installed. UI-facing jobs must be checked in a real browser: start the server in the worktree on a free port (`--bind 127.0.0.1`), then use a named session, e.g. `playwright-cli -s=<job-id> open http://127.0.0.1:<port>/`, `resize 375 812` (phone) and `resize 1280 800` (desktop), `screenshot`, `snapshot`, `console`, `click <ref>`, then `close`. Save screenshots into the job folder (`factory/jobs/<id>/`), never into the repo. Stop the server afterwards. Builder: verify UI acceptance criteria this way. UI/UX reviewers and approver: look at the page at both sizes before the verdict.
- Lint / format: `none yet`

## Sources
- GitHub issues: rokde/kartenspiele
- Jira: none

## Conventions
- UI: responsive design (mobile phone portrait up to desktop; table and cards must fit and be tappable on a small screen). Make it pretty and a bit playful: warm colors, friendly rounded shapes, small lively touches (hover/tap feedback, gentle transitions), while keeping it readable and accessible (contrast, focus states, `prefers-reduced-motion`).
- Deploy: GitHub Pages (https://rokde.github.io/kartenspiele/) via `.github/workflows/pages.yml` on every push to `main`; the orchestrator pushes `main` to `origin` after each merge (never force-push).
- UI language: German. Code, comments, commits: English, Conventional Commits.

## Factory rules
- Product code never goes into `factory/` or `.claude/`.
- One job = one branch `factory/<job-id>` in its own worktree
  `.claude/worktrees/factory-<job-id>`, created from the base ref.
- Smallest complete change. A known limit gets a `shortcut: <limit>, <when to upgrade>` comment.
