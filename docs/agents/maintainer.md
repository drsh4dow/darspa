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
7. `gh pr checks --watch` until Quality is green. CodeRabbit also reviews the pull request. Fix or answer each of its comments with him, then resolve the thread. When it requests changes, GitHub blocks the merge until it approves, which it does about a minute after its last thread is resolved.
8. When the pull request touches a path in `.github/CODEOWNERS`, GitHub has asked Daniel to review it and blocks the merge until he approves. Tell him that and stop. Otherwise, with his OK, run `gh pr merge --squash --delete-branch`.
9. Watch the Deploy run with `gh run watch`, then open the page on https://darspa.cl with him.

## Daniel reviews these

`.github/CODEOWNERS` lists the paths that need Daniel's approval: the database schema and migrations, payments, infrastructure, CI, and dependencies. These go live on merge and are hard to undo.

The deploy workflow is the only path to dev and prod. Manual deploy and plan commands stay with Daniel.

## Staff access

`docs/environments.md` describes `vp run admin:grant` and `admin:revoke`. Before running either, read back to him the email, the database, and the reason, and wait for his yes.

## When stuck

- `claude` asks to log in again: `/login`.
- `vp` is missing: `vp env doctor`.
- `vp run dev` fails on credentials: `infisical login`, or `vp exec alchemy profile edit --profile darspa --add Cloudflare`.
- Git looks confused: show him `git status` and keep his work. Ask Daniel before deleting or resetting anything.
