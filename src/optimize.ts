import sharp from 'sharp';
import { env } from './env.js';
import { listPagesToOptimize, updatePageImageUrl, type PageToOptimize } from './convex.js';
import { r2KeyFromUrl, webpKeyFor, downloadOriginal, uploadWebp } from './r2.js';

export type OptimizeOptions = {
  /** Convert and measure, but never upload or touch Convex. */
  dryRun?: boolean;
  /** Only process pages belonging to this story. */
  storyId?: string;
  /** Stop after this many pages (dry run or not) — a safety valve for a first pass. */
  limit?: number;
};

export type PageResult = {
  pageId: string;
  storyId: string;
  pageNumber: number;
  originalUrl: string;
  newUrl?: string;
  bytesBefore: number;
  bytesAfter: number;
  status: 'converted' | 'skipped' | 'error';
  error?: string;
};

export type OptimizeSummary = {
  dryRun: boolean;
  startedAt: string;
  finishedAt: string;
  results: PageResult[];
  totals: {
    pages: number;
    converted: number;
    skipped: number;
    errors: number;
    bytesBefore: number;
    bytesAfter: number;
  };
};

async function processPage(
  page: PageToOptimize,
  dryRun: boolean,
): Promise<PageResult> {
  const key = r2KeyFromUrl(page.imageUrl);
  if (!key) {
    return {
      pageId: page.pageId,
      storyId: page.storyId,
      pageNumber: page.pageNumber,
      originalUrl: page.imageUrl,
      bytesBefore: 0,
      bytesAfter: 0,
      status: 'skipped',
      error: 'URL is not hosted on the configured R2 bucket',
    };
  }

  try {
    const original = await downloadOriginal(page.imageUrl);
    const converted = await sharp(original)
      .webp({ quality: env.WEBP_QUALITY })
      .toBuffer();

    const newKey = webpKeyFor(key);
    let newUrl: string | undefined;

    if (!dryRun) {
      newUrl = await uploadWebp(newKey, converted);
      await updatePageImageUrl(page.pageId, newUrl);
    }

    return {
      pageId: page.pageId,
      storyId: page.storyId,
      pageNumber: page.pageNumber,
      originalUrl: page.imageUrl,
      newUrl,
      bytesBefore: original.byteLength,
      bytesAfter: converted.byteLength,
      status: 'converted',
    };
  } catch (error) {
    return {
      pageId: page.pageId,
      storyId: page.storyId,
      pageNumber: page.pageNumber,
      originalUrl: page.imageUrl,
      bytesBefore: 0,
      bytesAfter: 0,
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Sequential on purpose. The catalog is small (dozens, not thousands, of
 * pages) and this is much gentler on R2 and Convex than firing every request
 * at once — worth the extra runtime for a job that touches every story's
 * live images.
 */
export async function runOptimize(options: OptimizeOptions = {}): Promise<OptimizeSummary> {
  const dryRun = options.dryRun ?? true;
  const startedAt = new Date().toISOString();

  let pages = await listPagesToOptimize();
  if (options.storyId) {
    pages = pages.filter((p) => p.storyId === options.storyId);
  }
  if (options.limit) {
    pages = pages.slice(0, options.limit);
  }

  const results: PageResult[] = [];
  for (const page of pages) {
    results.push(await processPage(page, dryRun));
  }

  const totals = results.reduce(
    (acc, r) => {
      acc.pages += 1;
      if (r.status === 'converted') acc.converted += 1;
      if (r.status === 'skipped') acc.skipped += 1;
      if (r.status === 'error') acc.errors += 1;
      acc.bytesBefore += r.bytesBefore;
      acc.bytesAfter += r.bytesAfter;
      return acc;
    },
    { pages: 0, converted: 0, skipped: 0, errors: 0, bytesBefore: 0, bytesAfter: 0 },
  );

  return {
    dryRun,
    startedAt,
    finishedAt: new Date().toISOString(),
    results,
    totals,
  };
}
