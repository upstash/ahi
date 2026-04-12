# Daily News Researcher

A scheduled example project that researches one topic each day and saves a one-sentence summary to durable storage.

## What It Shows

- `schedules` in `ahi.yaml`
- a focused skill for recurring work
- a tool that writes durable output to `data/`
- a simple file you can inspect after each run

## Project Layout

```text
daily-news-researcher/
├── ahi.yaml
├── .env.example
├── tools/
│   └── news-summary.ts
├── skills/
│   └── SKILL.md
└── data/
    └── .gitkeep
```

## How It Works

The agent runs once per day, researches a news topic, writes exactly one sentence, and saves it to `data/daily-summary.md`.

The included tool only handles persistence. The research step is done by the agent using its own capabilities.

## Try It

```bash
cd examples/daily-news-researcher
ahi dev "Research the latest AI news and save today's summary."
cat data/daily-summary.md
```

## Notes

- Adjust the schedule in `ahi.yaml` to match your preferred topic and run time.
- Set the provider API key you need in `.env`.
- If your chosen agent runtime does not have web access, replace the prompt with a source you control or add your own fetch tool.
