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
