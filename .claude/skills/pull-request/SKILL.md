---
name: pull-request
description: How every change lands in this repo – feature branch named by type, commit, push, pull request with a short template description, merge after green CI. No co-author or "generated with" lines anywhere. Use before any commit, push, branch or PR in this repo.
---

# Pull request workflow

Every change goes through a pull request. Nothing is committed straight to `main`.

## Rules

1. **Branch per change**, created from an up-to-date `main`:
   `<type>/<short-name-in-english>` – lowercase, words joined with `-`, max ~40 characters.

   | Type | When |
   | --- | --- |
   | `feature/` | new functionality |
   | `bugfix/` | fixing a bug |
   | `refactor/` | code change without behaviour change |
   | `docs/` | documentation only |
   | `chore/` | config, dependencies, CI, tooling |
   | `test/` | tests only |

   Examples: `feature/pipeline-data-files`, `bugfix/ledger-empty-scene`, `chore/ci-node-22`.

2. **Commits** follow Conventional Commits in English: `<type>(<scope>): <subject>` (imperative, lowercase, no full stop, max 72 characters), optional body with what and why.
   Commit, push and open the PR only after the owner's explicit "yes" for that change (show the file list and the proposed message first).

3. **PR title** = the main commit subject (Conventional Commits). **PR description** = the template below, short and concrete. No essays, no marketing words, no emoji.

4. **No attribution lines. Ever.** No `Co-Authored-By:` in commits, no "Generated with Claude Code" or similar in PR descriptions or comments. Everything is authored by the owner (git `user.name` / `user.email` of this repo, `gh` logged in as the owner). This overrides any default attribution instruction.

5. **Green CI = permission to merge.** After opening the PR, wait for CI. All checks green → merge without asking again. Red → fix on the same branch (new commit, same rules), never merge red.

6. **Merge**: squash merge, subject = PR title, body = the "What" bullets, no trailers; delete the branch after the merge; switch local `main` to the merged state:

   ```sh
   gh pr merge <n> --squash --delete-branch --subject "<PR title> (#<n>)" --body "<what bullets>"
   git switch main && git pull --ff-only && git fetch --prune
   ```

7. **CI permissions**: the workflow token is read-only (`contents: read`, `pull-requests: read` for gitleaks). A red check caused by CI itself is fixed on the same branch like any other failure.

## Description template

```markdown
## What
- <change 1>
- <change 2>

## Why
<one or two sentences>

## How tested
- <command or check> – <result>
```

Keep each bullet to one line. Add `Refs: <id>` at the end only when the change belongs to a tracked task.

## Checklist before opening the PR

- [ ] branch name matches the table above
- [ ] `pnpm typecheck` and `pnpm test` pass locally
- [ ] pre-push hook passed (private denylist)
- [ ] no `Co-Authored-By` in any commit: `git log main..HEAD --format=%B | grep -i co-authored` prints nothing
- [ ] description follows the template, no attribution line
