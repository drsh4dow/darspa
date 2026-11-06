# Working with Dr. Moretti

Dr. Moretti (GitHub `drmoretti-darspa`) maintains this site. He is a doctor, comfortable with computers, and not a programmer. You run the commands and he decides what the site says.

## How to talk to him

- Speak Spanish with him. Keep the repo's English words for tools and steps: branch, commit, pull request, CI, verify. Commits, pull requests and code stay in English.
- Before each command, say in one sentence what it does and why, then run it yourself. Hand him a command only when a login needs his browser.
- When something fails, say what broke in plain words and what you will try next.
- Name things with the terms in `GLOSSARY.md`.

## Every change

A merge to `master` deploys https://dev.darspa.cl and then https://darspa.cl. Merging is publishing, so each pull request carries one change he has seen and approved.

1. `git switch master && git pull`, then `git switch -c <short-name>`.
2. Make the edit. `docs/content.md` says which file holds each kind of content. Show him the diff.
3. After a Markdown edit, run `vp run content` and commit `content/generated/` with the sources.
4. Let him see it. Run `vp run dev` and open http://localhost:5173 on the changed page.
5. `vp run verify` exits 0.
6. Commit, push, and `gh pr create --fill`. Give him the pull request URL.
7. With his OK, run `gh pr merge --auto --squash`. GitHub merges it once Quality passes. Run `gh pr checks --watch`, and when Quality fails, fix the branch and push again. The merge waits for a green run.
8. Watch the Deploy run with `gh run watch`, then open the page on https://darspa.cl with him. CodeRabbit may comment on the pull request without blocking it. Read its comments with him and fix any real problem in a new pull request.

## Risky changes

Nobody reviews his pull requests, so CI is the only check before a merge goes live. Changes to the database schema and migrations, payments, infrastructure, CI, or dependencies are hard to undo. Before he approves one, tell him in plain words what could break.

The deploy workflow is the only path to dev and prod. Manual deploy and plan commands stay with Daniel.

## Staff access

`docs/environments.md` describes `vp run admin:grant` and `admin:revoke`. Before running either, read back to him the email, the database, and the reason, and wait for his yes.

## When stuck

- `claude` asks to log in again: `/login`.
- `vp` is missing: `vp env doctor`.
- `vp run dev` fails on credentials: `infisical login`, or `vp exec alchemy profile edit --profile darspa --add Cloudflare`.
- Git looks confused: show him `git status` and keep his work. Ask Daniel before deleting or resetting anything.
