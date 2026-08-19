import express from 'express';
import { randomUUID } from 'node:crypto';
import { env } from './env.js';
import { runOptimize, type OptimizeSummary } from './optimize.js';

if (!env.TRIGGER_SECRET) {
  throw new Error('TRIGGER_SECRET must be set to run the HTTP server (protects POST /run).');
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

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

// Runs are triggered manually, not on a schedule — the story catalog changes
// rarely and touching every page's live image is worth a deliberate action,
// not a cron job nobody is watching.
app.post('/run', (req, res) => {
  const key = req.header('x-api-key');
  if (key !== env.TRIGGER_SECRET) {
    return res.status(401).json({ error: 'unauthorized' });
  }

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

app.get('/status/:id', (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) {
    return res.status(404).json({ error: 'unknown job id' });
  }
  res.json(job);
});

app.get('/status', (_req, res) => {
  const all = [...jobs.values()].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  res.json(all.slice(0, 20));
});

app.listen(env.PORT, () => {
  console.log(`squoosh-optimizer listening on :${env.PORT}`);
});
