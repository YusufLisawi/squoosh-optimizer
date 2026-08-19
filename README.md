# squoosh-optimizer

Shrinks images. Two things live here:

1. **`POST /optimize`** — generic, no auth. Send any image, get a smaller one
   back. Usable from any project.
2. **`/tinytales/*`** — specific to TinyTales' story catalog. Batch-converts
   every page image to WebP, uploads to R2, updates Convex. Requires an API key.

Named after Squoosh, but doesn't use its code — Squoosh's Node library
(`@squoosh/lib`) was deleted from the upstream repo in Jan 2023 and marked
unmaintained. This uses [`sharp`](https://sharp.pixelplumb.com/) instead,
which is actively maintained.

**Full API reference, both endpoints, curl + HTML examples: https://squoosh.brainfast.ai/docs**

## Quick use — generic endpoint

```bash
curl https://squoosh.brainfast.ai/optimize?format=webp \
  --data-binary @photo.jpg -H "Content-Type: image/jpeg" \
  -o photo.webp
```

## Why the TinyTales half exists

Story page images were uploaded as raw PNG/JPEG (2-3 MB each). Covers were
already converted to WebP (~200 KB) as part of an earlier pass; this does the
same for pages. Measured ~90% size reduction with no visible quality loss at
`WEBP_QUALITY=80`.

## Local use (CLI, TinyTales-specific)

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

From the TinyTales repo itself, `scripts/optimizeStoryImages.ts` wraps the
deployed `/tinytales/run` endpoint and fetches the API key from Coolify
automatically — nothing to paste. Run it after adding a new story:

```bash
npx tsx scripts/optimizeStoryImages.ts <story-slug>            # dry run
npx tsx scripts/optimizeStoryImages.ts <story-slug> --apply    # for real
```

## Deployed service

Runs on Coolify at `squoosh.brainfast.ai`. `/tinytales/*` is triggered
manually — no cron, the catalog changes rarely and this touches every story's
live images, so it's a deliberate action, not a schedule. `/optimize` has no
trigger to speak of — it just answers requests as they come in.

## Env vars

| Var | Required for | Notes |
|---|---|---|
| `CONVEX_URL` | tinytales list/dry-run/apply | not secret, same URL used by the mobile app |
| `R2_PUBLIC_URL` | tinytales list/dry-run/apply | public bucket base URL |
| `R2_ACCOUNT_ID` | tinytales apply only | |
| `R2_ACCESS_KEY_ID` | tinytales apply only | |
| `R2_SECRET_ACCESS_KEY` | tinytales apply only | |
| `R2_BUCKET_NAME` | tinytales apply only | |
| `R2_ENDPOINT` | tinytales apply only | |
| `TRIGGER_SECRET` | HTTP server | required for every `/tinytales/*` route; `/optimize` doesn't use it |
| `WEBP_QUALITY` | optional | default 80, CLI only |
| `PORT` | optional | default 3000 |
