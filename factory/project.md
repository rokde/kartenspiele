# Project context

Every factory agent reads this file first. Only the orchestrator writes it: it
fills it in on `/factory:init`, re-checks it at the start of each job, and
refreshes it after each merge.

## Repo
- Base: `main`, or the local target branch when it already contains the base
  (local merges not pushed yet). Every job's worktree starts there.
- Merge target: `main` (local, not pushed)
- Language / stack: none yet (see `factory/product.md` once planned)
- Install: `none yet`. Run it once in each new worktree.
- Test command: `none yet`
- Lint / format: `none yet`

## Sources
- GitHub issues: none (no `origin` remote)
- Jira: none

## Conventions
none yet (new repo, no commits with code)

## Factory rules
- Product code never goes into `factory/` or `.claude/`.
- One job = one branch `factory/<job-id>` in its own worktree
  `.claude/worktrees/factory-<job-id>`, created from the base ref.
- Smallest complete change. A known limit gets a `shortcut: <limit>, <when to upgrade>` comment.
