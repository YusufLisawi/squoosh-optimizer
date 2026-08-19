import express from 'express';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { env } from './env.js';
import { runOptimize, type OptimizeSummary } from './optimize.js';
import { docsHtml } from './docs.js';

if (!env.TRIGGER_SECRET) {
  throw new Error('TRIGGER_SECRET must be set to run the HTTP server (protects the API).');
}

type Job = {
  id: string;
  status: 'running' | 'done' | 'error';
  startedAt: string;
  finishedAt?: string;
  summary?: OptimizeSummary;
  error?: string;
};

const jobs = new Map<string, Job>();

const app = express();
app.use(express.json());

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

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/docs', (_req, res) => {
  res.type('html').send(docsHtml);
});

// Runs are triggered manually, not on a schedule — the story catalog changes
// rarely and touching every page's live image is worth a deliberate action,
// not a cron job nobody is watching.
app.post('/run', requireApiKey, (req, res) => {
  const dryRun = req.body?.dryRun !== false; // defaults to true — real writes are opt-in
  const storyId = typeof req.body?.storyId === 'string' ? req.body.storyId : undefined;
  const limit = typeof req.body?.limit === 'number' ? req.body.limit : undefined;

  const id = randomUUID();
  const job: Job = { id, status: 'running', startedAt: new Date().toISOString() };
  jobs.set(id, job);

  // Fire-and-forget: the full catalog can take longer than a reverse proxy's
  // request timeout, so the client polls GET /status/:id instead of waiting
  // on this response.
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
app.get('/status/:id', requireApiKey, (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) {
    return res.status(404).json({ error: 'unknown job id' });
  }
  res.json(job);
});

app.get('/status', requireApiKey, (_req, res) => {
  const all = [...jobs.values()].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  res.json(all.slice(0, 20));
});

app.listen(env.PORT, () => {
  console.log(`squoosh-optimizer listening on :${env.PORT}`);
});
