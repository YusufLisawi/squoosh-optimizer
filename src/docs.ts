export const docsHtml = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>squoosh-optimizer API</title>
<style>
  :root { color-scheme: light dark; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; max-width: 760px; margin: 0 auto; padding: 40px 24px 80px; line-height: 1.55; }
  h1 { font-size: 1.6em; margin-bottom: 4px; }
  h2 { font-size: 1.15em; margin-top: 2.2em; border-bottom: 1px solid rgba(128,128,128,.3); padding-bottom: 6px; }
  p.lead { opacity: .75; margin-top: 0; }
  code, pre { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 0.92em; }
  pre { background: rgba(128,128,128,.12); padding: 14px 16px; border-radius: 8px; overflow-x: auto; }
  code.inline { background: rgba(128,128,128,.15); padding: 1px 6px; border-radius: 4px; }
  table { border-collapse: collapse; width: 100%; margin: 12px 0; }
  th, td { text-align: left; padding: 6px 10px 6px 0; border-bottom: 1px solid rgba(128,128,128,.2); font-size: 0.94em; }
  .badge { display: inline-block; font-size: 0.75em; font-weight: 600; padding: 2px 8px; border-radius: 999px; background: rgba(128,128,128,.15); margin-left: 6px; }
  .warn { border-left: 3px solid #e0a800; background: rgba(224,168,0,.08); padding: 10px 14px; border-radius: 4px; margin: 14px 0; }
</style>
</head>
<body>

<h1>squoosh-optimizer</h1>
<p class="lead">Converts TinyTales story page images to WebP, uploads them to R2, and updates the corresponding Convex records. Triggered manually — no cron.</p>

<h2>Authentication</h2>
<p>Every endpoint except <code class="inline">/health</code> and this page requires an API key in the <code class="inline">x-api-key</code> header.</p>
<pre>x-api-key: &lt;your key&gt;</pre>
<div class="warn">
  <strong>Keep the key secret.</strong> It's stored as <code class="inline">TRIGGER_SECRET</code> in this app's Coolify environment variables — never in git, never in client-side code, never pasted into a chat or ticket. A wrong or missing key gets <code class="inline">401 Unauthorized</code>. If it's ever exposed, rotate it in Coolify and every caller needs the new value.
</div>

<h2>Endpoints</h2>
<table>
  <tr><th>Method &amp; path</th><th>Auth</th><th>What it does</th></tr>
  <tr><td><code class="inline">GET /health</code></td><td>—</td><td>Liveness check</td></tr>
  <tr><td><code class="inline">POST /run</code></td><td>required</td><td>Starts a conversion job, returns a job id immediately</td></tr>
  <tr><td><code class="inline">GET /status</code></td><td>required</td><td>Last 20 jobs</td></tr>
  <tr><td><code class="inline">GET /status/:id</code></td><td>required</td><td>One job's full result</td></tr>
</table>

<h2>POST /run</h2>
<p>Fire-and-forget: this returns as soon as the job is queued, not when it finishes (a full catalog run can take minutes). Poll <code class="inline">/status/:id</code> for the result.</p>
<table>
  <tr><th>Body field</th><th>Type</th><th>Default</th><th>Meaning</th></tr>
  <tr><td><code class="inline">dryRun</code></td><td>boolean</td><td><code class="inline">true</code></td><td>Convert and measure only — no upload, no database write. Real writes are opt-in.</td></tr>
  <tr><td><code class="inline">storyId</code></td><td>string</td><td>—</td><td>Limit to one story</td></tr>
  <tr><td><code class="inline">limit</code></td><td>number</td><td>—</td><td>Stop after this many pages</td></tr>
</table>

<p><strong>Dry run (safe — no writes):</strong></p>
<pre>curl -X POST https://squoosh.brainfast.ai/run \\
  -H "x-api-key: $TRIGGER_SECRET" \\
  -H "content-type: application/json" \\
  -d '{"dryRun": true}'</pre>

<p><strong>Real run, one story:</strong></p>
<pre>curl -X POST https://squoosh.brainfast.ai/run \\
  -H "x-api-key: $TRIGGER_SECRET" \\
  -H "content-type: application/json" \\
  -d '{"dryRun": false, "storyId": "&lt;convex story id&gt;"}'</pre>

<p><strong>Real run, everything:</strong></p>
<pre>curl -X POST https://squoosh.brainfast.ai/run \\
  -H "x-api-key: $TRIGGER_SECRET" \\
  -H "content-type: application/json" \\
  -d '{"dryRun": false}'</pre>

<h2>Check a job</h2>
<pre>curl https://squoosh.brainfast.ai/status/&lt;jobId&gt; \\
  -H "x-api-key: $TRIGGER_SECRET"</pre>
<p>Response shape:</p>
<pre>{
  "id": "...",
  "status": "running" | "done" | "error",
  "startedAt": "...",
  "finishedAt": "...",
  "summary": {
    "dryRun": false,
    "totals": { "pages": 33, "converted": 33, "skipped": 0, "errors": 0,
                "bytesBefore": 80992370, "bytesAfter": 6438788 },
    "results": [ { "storyId": "...", "pageNumber": 1, "status": "converted",
                    "bytesBefore": 2812345, "bytesAfter": 335210,
                    "newUrl": "https://pub-....r2.dev/story-25/images/1.webp" } ]
  }
}</pre>

<h2>Safety notes</h2>
<ul>
  <li>Originals are never deleted. New <code class="inline">.webp</code> files are uploaded alongside the source PNG/JPEG — a failed or bad run doesn't lose anything, and there's a rollback path if a converted image ever looks wrong.</li>
  <li>Always dry-run a new <code class="inline">storyId</code> before running it for real.</li>
  <li>A page that fails is skipped and reported in <code class="inline">results</code> — it does not stop the rest of the batch.</li>
</ul>

</body>
</html>`;
