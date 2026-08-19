import express from 'express';
import multer from 'multer';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { env } from './env.js';
import { runOptimize, type OptimizeSummary } from './optimize.js';
import { convertImage, isSupportedFormat, SUPPORTED_FORMATS, type OutputFormat } from './generic.js';
import { docsHtml } from './docs.js';

if (!env.TRIGGER_SECRET) {
  throw new Error('TRIGGER_SECRET must be set to run the HTTP server (protects the TinyTales API).');
}

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/docs', (_req, res) => {
  res.type('html').send(docsHtml);
});

// ─────────────────────────────────────────────────────────────────────────
// GENERIC: shrink one image, get it back. No history, nothing kept — but it
// still requires the same key as everything else below, so this server
// doesn't become an open image-conversion host for anyone who finds the URL.
// Usable by any project, not just TinyTales — just needs the key.
// ─────────────────────────────────────────────────────────────────────────

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_UPLOAD_BYTES } });

app.post(
  '/optimize',
  requireApiKey,
  express.raw({ type: 'image/*', limit: MAX_UPLOAD_BYTES }),
  upload.single('image'),
  async (req, res) => {
    const image = req.file?.buffer ?? (Buffer.isBuffer(req.body) ? req.body : undefined);
    if (!image || image.byteLength === 0) {
      return res.status(400).json({
        error: 'No image provided. Send it as multipart/form-data (field "image") or as the raw request body with an image/* Content-Type.',
      });
    }

    const formatParam = String(req.query.format ?? 'webp');
    if (!isSupportedFormat(formatParam)) {
      return res.status(400).json({
        error: `Unsupported format "${formatParam}". Use one of: ${SUPPORTED_FORMATS.join(', ')}`,
      });
    }
    const format: OutputFormat = formatParam;

    const quality = Math.min(100, Math.max(1, Number(req.query.quality ?? 80) || 80));

    try {
      const result = await convertImage(image, format, quality);
      res.set('Content-Type', result.contentType);
      res.set('Content-Disposition', `attachment; filename="optimized.${format}"`);
      res.set('X-Bytes-Before', String(result.bytesBefore));
      res.set('X-Bytes-After', String(result.bytesAfter));
      res.send(result.bytes);
    } catch (error) {
      res.status(422).json({
        error: 'Could not decode that as an image.',
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────
// TINYTALES: batch-converts the story catalog's page images, uploads to R2,
// updates Convex. Same key as /optimize above, but everything here is
// specific to that one project's data.
// ─────────────────────────────────────────────────────────────────────────

type Job = {
  id: string;
  status: 'running' | 'done' | 'error';
  startedAt: string;
  finishedAt?: string;
  summary?: OptimizeSummary;
  error?: string;
};

const jobs = new Map<string, Job>();

/**
 * Constant-time comparison, not `===`. A plain string comparison exits at
 * the first mismatched byte, so its timing leaks how many leading characters
 * of a guess were correct — over enough requests that's enough to brute-force
 * the key. `timingSafeEqual` always takes the same time regardless of where
 * the difference is, so no measurement of it can help.
 */
function isValidApiKey(provided: string | undefined): boolean {
  if (!provided) return false;
  const expected = Buffer.from(env.TRIGGER_SECRET!);
  const actual = Buffer.from(provided);
  // Buffers of different lengths can't go through timingSafeEqual, but their
  // *length* isn't sensitive the way byte-by-byte content is, so a fixed-cost
  // early return here doesn't reopen the timing side-channel above.
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

function requireApiKey(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) {
  if (!isValidApiKey(req.header('x-api-key'))) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
}

const tinytales = express.Router();

// Runs are triggered manually, not on a schedule — the story catalog changes
// rarely and touching every page's live image is worth a deliberate action,
// not a cron job nobody is watching.
tinytales.post('/run', requireApiKey, (req, res) => {
  const dryRun = req.body?.dryRun !== false; // defaults to true — real writes are opt-in
  const storyId = typeof req.body?.storyId === 'string' ? req.body.storyId : undefined;
  const limit = typeof req.body?.limit === 'number' ? req.body.limit : undefined;

  const id = randomUUID();
  const job: Job = { id, status: 'running', startedAt: new Date().toISOString() };
  jobs.set(id, job);

  // Fire-and-forget: the full catalog can take longer than a reverse proxy's
  // request timeout, so the client polls GET /tinytales/status/:id instead of
  // waiting on this response.
  runOptimize({ dryRun, storyId, limit })
    .then((summary) => {
      job.status = 'done';
      job.finishedAt = new Date().toISOString();
      job.summary = summary;
    })
    .catch((error) => {
      job.status = 'error';
      job.finishedAt = new Date().toISOString();
      job.error = error instanceof Error ? error.message : String(error);
    });

  res.status(202).json({ jobId: id, dryRun, storyId, limit });
});

// Job results include story ids and byte counts — not secret, but not public
// either, so this needs the same key as /run rather than being left open.
tinytales.get('/status/:id', requireApiKey, (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) {
    return res.status(404).json({ error: 'unknown job id' });
  }
  res.json(job);
});

tinytales.get('/status', requireApiKey, (_req, res) => {
  const all = [...jobs.values()].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  res.json(all.slice(0, 20));
});

app.use('/tinytales', tinytales);

app.listen(env.PORT, () => {
  console.log(`squoosh-optimizer listening on :${env.PORT}`);
});
