# Bachata Crush 問答

A small Q&A site that answers questions about [bachatacrush.com](https://bachatacrush.com) using Claude.
Site content is pulled live from the site's WordPress API (cached for 1 hour) and given to Claude as its only source.

## Run locally

```bash
cp .env.example .env.local   # then fill in ANTHROPIC_API_KEY
npm install
npm run dev
```

## Deploy

Import the repo in Vercel and set the `ANTHROPIC_API_KEY` environment variable.
