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
  h2 { font-size: 1.25em; margin-top: 2.6em; }
  h3 { font-size: 1.05em; margin-top: 2em; border-bottom: 1px solid rgba(128,128,128,.3); padding-bottom: 6px; }
  p.lead { opacity: .75; margin-top: 0; }
  code, pre { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 0.92em; }
  pre { background: rgba(128,128,128,.12); padding: 14px 16px; border-radius: 8px; overflow-x: auto; }
  code.inline { background: rgba(128,128,128,.15); padding: 1px 6px; border-radius: 4px; }
  table { border-collapse: collapse; width: 100%; margin: 12px 0; }
  th, td { text-align: left; padding: 6px 10px 6px 0; border-bottom: 1px solid rgba(128,128,128,.2); font-size: 0.94em; }
  .warn { border-left: 3px solid #e0a800; background: rgba(224,168,0,.08); padding: 10px 14px; border-radius: 4px; margin: 14px 0; }
  .section { border: 1px solid rgba(128,128,128,.25); border-radius: 10px; padding: 4px 20px 20px; margin-top: 28px; }
  .tag { display: inline-block; font-size: 0.72em; font-weight: 700; letter-spacing: .03em; text-transform: uppercase; padding: 2px 9px; border-radius: 999px; margin-left: 8px; vertical-align: middle; }
  .tag.open { background: rgba(40,167,69,.15); color: #2ea043; }
  .tag.auth { background: rgba(224,168,0,.15); color: #cc9200; }
</style>
</head>
<body>

<h1>squoosh-optimizer</h1>
<p class="lead">Shrinks images. Two things live here: a generic "give me an image, get a smaller one back" API anyone can use, and a batch pipeline specific to TinyTales' story catalog.</p>

<div class="section">
<h2>Generic image optimization <span class="tag open">no auth</span></h2>
<p>Send an image, get a smaller one back. Stateless — nothing is stored, nothing is logged beyond a normal access log. Use it from anything: curl, a browser form, another app.</p>

<h3>POST /optimize</h3>
<table>
  <tr><th>Query param</th><th>Default</th><th>Meaning</th></tr>
  <tr><td><code class="inline">format</code></td><td><code class="inline">webp</code></td><td>One of <code class="inline">webp</code>, <code class="inline">avif</code>, <code class="inline">jpeg</code>, <code class="inline">png</code></td></tr>
  <tr><td><code class="inline">quality</code></td><td><code class="inline">80</code></td><td>1-100</td></tr>
</table>
<p>Send the image either way:</p>
<ul>
  <li><code class="inline">multipart/form-data</code> with a field named <code class="inline">image</code> — what an HTML <code class="inline">&lt;form&gt;</code> or most HTTP clients send by default.</li>
  <li>Raw bytes as the request body with an <code class="inline">image/*</code> Content-Type.</li>
</ul>
<p>The response <strong>is</strong> the converted image — <code class="inline">Content-Disposition: attachment</code> so it downloads directly, plus <code class="inline">X-Bytes-Before</code> / <code class="inline">X-Bytes-After</code> headers if you want the size delta without decoding the file.</p>

<p><strong>curl, raw body:</strong></p>
<pre>curl https://squoosh.brainfast.ai/optimize?format=webp\\&quality=80 \\
  --data-binary @photo.jpg \\
  -H "Content-Type: image/jpeg" \\
  -o photo.webp</pre>

<p><strong>curl, multipart (form-upload style):</strong></p>
<pre>curl https://squoosh.brainfast.ai/optimize?format=avif \\
  -F "image=@photo.jpg" \\
  -o photo.avif</pre>

<p><strong>HTML form:</strong></p>
<pre>&lt;form method="post" action="https://squoosh.brainfast.ai/optimize?format=webp" enctype="multipart/form-data"&gt;
  &lt;input type="file" name="image" accept="image/*" /&gt;
  &lt;button&gt;Optimize&lt;/button&gt;
&lt;/form&gt;</pre>

<p>Max upload size: <strong>25 MB</strong>. Bad/corrupt image → <code class="inline">422</code>. Unsupported <code class="inline">format</code> → <code class="inline">400</code>.</p>
<div class="warn">Open by design, so there's no per-caller quota — it's rate-limited only by server capacity. If it's ever abused, the fix is adding auth here, not something callers need to plan around today.</div>
</div>

<div class="section">
<h2>TinyTales story catalog <span class="tag auth">requires x-api-key</span></h2>
<p>Batch-converts every page image in the TinyTales story catalog, uploads the result to R2, and updates the matching Convex record. Specific to that one project's data — everything below needs the shared secret.</p>

<h3>Authentication</h3>
<pre>x-api-key: &lt;your key&gt;</pre>
<div class="warn">
  <strong>Keep the key secret.</strong> It's stored as <code class="inline">TRIGGER_SECRET</code> in this app's Coolify environment variables — never in git, never in client-side code. A wrong or missing key gets <code class="inline">401 Unauthorized</code>. If it ever leaks, rotate it in Coolify and every caller needs the new value.
</div>

<table>
  <tr><th>Method &amp; path</th><th>What it does</th></tr>
  <tr><td><code class="inline">POST /tinytales/run</code></td><td>Starts a conversion job, returns a job id immediately</td></tr>
  <tr><td><code class="inline">GET /tinytales/status</code></td><td>Last 20 jobs</td></tr>
  <tr><td><code class="inline">GET /tinytales/status/:id</code></td><td>One job's full result</td></tr>
</table>

<h3>POST /tinytales/run</h3>
<p>Fire-and-forget: returns as soon as the job is queued, not when it finishes (a full-catalog run can take minutes). Poll <code class="inline">/tinytales/status/:id</code> for the result.</p>
<table>
  <tr><th>Body field</th><th>Type</th><th>Default</th><th>Meaning</th></tr>
  <tr><td><code class="inline">dryRun</code></td><td>boolean</td><td><code class="inline">true</code></td><td>Convert and measure only — no upload, no database write. Real writes are opt-in.</td></tr>
  <tr><td><code class="inline">storyId</code></td><td>string</td><td>—</td><td>Limit to one story</td></tr>
  <tr><td><code class="inline">limit</code></td><td>number</td><td>—</td><td>Stop after this many pages</td></tr>
</table>

<p><strong>Dry run (safe — no writes):</strong></p>
<pre>curl -X POST https://squoosh.brainfast.ai/tinytales/run \\
  -H "x-api-key: $TRIGGER_SECRET" \\
  -H "content-type: application/json" \\
  -d '{"dryRun": true}'</pre>

<p><strong>Real run, one story:</strong></p>
<pre>curl -X POST https://squoosh.brainfast.ai/tinytales/run \\
  -H "x-api-key: $TRIGGER_SECRET" \\
  -H "content-type: application/json" \\
  -d '{"dryRun": false, "storyId": "&lt;convex story id&gt;"}'</pre>

<h3>Check a job</h3>
<pre>curl https://squoosh.brainfast.ai/tinytales/status/&lt;jobId&gt; \\
  -H "x-api-key: $TRIGGER_SECRET"</pre>
<pre>{
  "id": "...",
  "status": "running" | "done" | "error",
  "summary": {
    "dryRun": false,
    "totals": { "pages": 33, "converted": 33, "skipped": 0, "errors": 0,
                "bytesBefore": 80992370, "bytesAfter": 6438788 },
    "results": [ { "storyId": "...", "pageNumber": 1, "status": "converted",
                    "bytesBefore": 2812345, "bytesAfter": 335210,
                    "newUrl": "https://pub-....r2.dev/story-25/images/1.webp" } ]
  }
}</pre>

<h3>Safety notes</h3>
<ul>
  <li>Originals are never deleted. New <code class="inline">.webp</code> files are uploaded alongside the source PNG/JPEG.</li>
  <li>Always dry-run a new <code class="inline">storyId</code> before running it for real.</li>
  <li>A page that fails is skipped and reported in <code class="inline">results</code> — it does not stop the rest of the batch.</li>
  <li>From the TinyTales repo, <code class="inline">scripts/optimizeStoryImages.ts</code> wraps this endpoint — fetches the key from Coolify automatically, run <code class="inline">npx tsx scripts/optimizeStoryImages.ts &lt;story-slug&gt; --apply</code>.</li>
</ul>
</div>

</body>
</html>`;
