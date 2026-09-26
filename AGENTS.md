# Working in this repository

Read [README.md](README.md) for setup and verification. Read [docs/environments.md](docs/environments.md) before changing environment variables, automation credentials, or deployment targets.

Implementation scope comes from the current ticket and [specification #1](https://github.com/drsh4dow/darspa/issues/1). The sibling `darspa-next` is a legacy reference; preserve its user changes. Installed Convex skills are guidance, not authority to add capabilities or select providers. Check APIs against the pinned packages when guidance conflicts.

Run `vp run verify` before handing off changes. Test observable workflows or consequential backend contracts, using explicit dependencies instead of module mocking. Backend functions use Convex argument and return validators; privileged setup functions remain internal.

This repository currently has only an isolated US East development deployment. Production deployment, paid-plan changes, and DNS cutover require owner authorization.
