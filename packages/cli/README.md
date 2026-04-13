# @upstash/ahi

CLI for running independent agents in isolated containers with Upstash Box.

## Install

```bash
npm install -g @upstash/ahi
```

## Commands

```bash
ahi init
ahi dev "remember that I prefer concise summaries"
ahi sync
ahi run "list the saved notes"
ahi console
```

`ahi init` scaffolds a minimal notes agent with:

- `tools/note.ts`
- `skills/SKILL.md`
- `data/`

It does not include schedules by default. For richer scheduled setups, see the root `examples/` folder.

If your tools need project dependencies on the Box, add a top-level `setup` array to `ahi.yaml`, for example:

```yaml
setup:
  - pnpm install --frozen-lockfile
```

During `ahi sync`, Ahi uploads common Node manifest files like `package.json` and lockfiles, then runs those setup commands remotely.

Setup commands currently run on every `ahi sync`.

This is currently intended for standard Node installs. Custom setup helper files outside the built-in manifest list are not synced automatically yet.
