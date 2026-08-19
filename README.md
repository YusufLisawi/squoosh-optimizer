# squoosh-optimizer

Converts TinyTales story page images to WebP, uploads them to R2 alongside the
originals, and updates the corresponding Convex `storyPages.imageUrl`.

Named after Squoosh, but doesn't use its code — Squoosh's Node library
(`@squoosh/lib`) was deleted from the upstream repo in Jan 2023 and marked
unmaintained. This uses [`sharp`](https://sharp.pixelplumb.com/) instead,
which is actively maintained.

## Why

Story page images were uploaded as raw PNG/JPEG (2-3 MB each). Covers were
already converted to WebP (~200 KB) as part of an earlier pass; this does the
same for pages. Measured ~90% size reduction with no visible quality loss at
`WEBP_QUALITY=80`.

## Local use (CLI)

```bash
bun install
cp .env.example .env.local   # fill in real values
set -a; source .env.local; set +a

bun run cli                        # dry run, full catalog — no writes
bun run cli --story=<id>           # dry run, one story
bun run cli --limit=5              # dry run, first 5 pages
bun run cli --apply --story=<id>   # REAL RUN for one story — uploads + updates Convex
bun run cli --apply                # REAL RUN for everything
```

Dry run never touches R2 credentials or Convex writes — it only downloads
originals (public URLs) and lists pages (read-only). Safe to run with
placeholder R2 write credentials.

## Deployed service

Runs as an HTTP service (`src/server.ts`) on Coolify at
`squoosh.brainfast.ai`, triggered manually — no cron, the catalog changes
rarely and this touches every story's live images, so it's a deliberate
action, not a schedule.

**Full API reference, auth, and examples: https://squoosh.brainfast.ai/docs**

## Env vars

| Var | Required for | Notes |
|---|---|---|
| `CONVEX_URL` | list, dry run, apply | not secret, same URL used by the mobile app |
| `R2_PUBLIC_URL` | list, dry run, apply | public bucket base URL |
| `R2_ACCOUNT_ID` | apply only | |
| `R2_ACCESS_KEY_ID` | apply only | |
| `R2_SECRET_ACCESS_KEY` | apply only | |
| `R2_BUCKET_NAME` | apply only | |
| `R2_ENDPOINT` | apply only | |
| `TRIGGER_SECRET` | HTTP server only | required to POST /run |
| `WEBP_QUALITY` | optional | default 80 |
| `PORT` | optional | default 3000 |
