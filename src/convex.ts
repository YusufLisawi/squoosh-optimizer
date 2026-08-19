import { ConvexHttpClient } from 'convex/browser';
import { env } from './env.js';

// This service lives outside the TinyTales repo, so it has no access to its
// generated `api` object. Convex's client accepts a plain "module:function"
// string in place of a typed FunctionReference at runtime — the generated
// object is purely a type-safety layer on top of that string, so this is a
// supported (if less-checked) way to call it from an independent service.
const client = new ConvexHttpClient(env.CONVEX_URL);

export type PageToOptimize = {
  pageId: string;
  storyId: string;
  pageNumber: number;
  imageUrl: string;
};

export async function listPagesToOptimize(): Promise<PageToOptimize[]> {
  return client.mutation('admin:listStoryPagesForImageOptimization' as any, {});
}

export async function updatePageImageUrl(
  pageId: string,
  imageUrl: string,
): Promise<void> {
  await client.mutation('admin:updatePageImageUrl' as any, { pageId, imageUrl });
}
