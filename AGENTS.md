# Verification

Run `vp run verify` before handing off changes.

# Learning more about Effect

This repository uses the Effect Typescript library.

Before writing any Effect code, first read `node_modules/effect/AGENTS.md`
**completely**, and follow the links in the file when required.

If you need to learn more about particular Effect apis and concepts that the
guide doesn't cover, search through the source code in `node_modules/effect/src`.

# Extra Rules

- Don't add docs unless needed to keep them in sync with reality or unless explicitly asked to.
- Avoid suppressing or removing linting rules.
- address warnings and errors before considering the work done.

# Agent skills

## Issue tracker

Issues are tracked in this repo's GitHub Issues via the `gh` CLI. See
`docs/agents/issue-tracker.md`.

## Domain docs

Single-context: `GLOSSARY.md` and `docs/adr/` at the repo root. See
`docs/agents/domain.md`.
