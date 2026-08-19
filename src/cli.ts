import { runOptimize } from './optimize.js';

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const found = process.argv.find((a) => a.startsWith(prefix));
  return found?.slice(prefix.length);
}

function fmtMB(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

async function main() {
  const dryRun = process.argv.includes('--apply') ? false : true;
  const storyId = arg('story');
  const limitArg = arg('limit');
  const limit = limitArg ? Number(limitArg) : undefined;

  console.log(
    `Running ${dryRun ? 'DRY RUN (no uploads, no DB writes)' : 'FOR REAL'}` +
      (storyId ? `, story=${storyId}` : '') +
      (limit ? `, limit=${limit}` : ''),
  );

  const summary = await runOptimize({ dryRun, storyId, limit });

  for (const r of summary.results) {
    if (r.status === 'converted') {
      const pct = r.bytesBefore > 0 ? Math.round((1 - r.bytesAfter / r.bytesBefore) * 100) : 0;
      console.log(
        `  ✓ story=${r.storyId} page=${r.pageNumber}  ${fmtMB(r.bytesBefore)} -> ${fmtMB(r.bytesAfter)}  (-${pct}%)` +
          (r.newUrl ? `  ${r.newUrl}` : ''),
      );
    } else if (r.status === 'skipped') {
      console.log(`  - skipped story=${r.storyId} page=${r.pageNumber}: ${r.error}`);
    } else {
      console.log(`  ✗ ERROR story=${r.storyId} page=${r.pageNumber}: ${r.error}`);
    }
  }

  console.log('');
  console.log(
    `Totals: ${summary.totals.pages} pages, ${summary.totals.converted} converted, ` +
      `${summary.totals.skipped} skipped, ${summary.totals.errors} errors`,
  );
  console.log(
    `Size: ${fmtMB(summary.totals.bytesBefore)} -> ${fmtMB(summary.totals.bytesAfter)}` +
      (summary.totals.bytesBefore > 0
        ? `  (-${Math.round((1 - summary.totals.bytesAfter / summary.totals.bytesBefore) * 100)}%)`
        : ''),
  );

  if (summary.totals.errors > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
