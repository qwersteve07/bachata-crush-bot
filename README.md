# Ask Bachata Crush Anything

A small Q&A site that answers questions about the Bachata Crush festival using Claude.
Its reference material is the official site (pulled live from the WordPress API, cached for 1 hour),
the Flow Taipei ticket page, and Instagram posts kept by hand in `data/instagram.md`
(refresh them with the `update-instagram` Claude Code skill).

## Run locally

Create `.env` with your Anthropic API key, then:

```bash
npm install
npm run dev
```

## Environment variables

| Name | Required | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | yes | Claude API key |
| `CHAT_MODEL` | no | Model ID; defaults to `claude-sonnet-5-5` |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | no | Upstash Redis (set by Vercel's Upstash integration) for per-IP rate limiting: 20 questions/hour, 60/day. Without them rate limiting is off. |

Each answer logs a `chat_usage` line (model, cached/uncached input tokens, output tokens) to the Vercel function logs.

## Compare models

Asks a fixed set of questions to Opus, Sonnet and Haiku with the production prompt and writes a report with answers, speed and cost (uses the API, well under US$1 per run):

```bash
npx tsx --env-file=.env scripts/compare-models.mts model-comparison.md
```

## Deploy

Pushes to `main` deploy automatically on Vercel.
