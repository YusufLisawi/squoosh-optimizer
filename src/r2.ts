import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { env } from './env.js';

const s3 = new S3Client({
  region: 'auto',
  endpoint: env.R2_ENDPOINT,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  },
});

/** Strip the bucket's public base URL off a full image URL to get its R2 key. */
export function r2KeyFromUrl(url: string): string | null {
  if (!url.startsWith(env.R2_PUBLIC_URL)) {
    return null;
  }
  return url.slice(env.R2_PUBLIC_URL.length).replace(/^\//, '');
}

/** Same path, `.webp` extension — sits beside the original, doesn't touch it. */
export function webpKeyFor(originalKey: string): string {
  return originalKey.replace(/\.[a-zA-Z0-9]+$/, '.webp');
}

export async function downloadOriginal(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Download failed (${res.status}): ${url}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

export async function uploadWebp(key: string, bytes: Buffer): Promise<string> {
  await s3.send(
    new PutObjectCommand({
      Bucket: env.R2_BUCKET_NAME,
      Key: key,
      Body: bytes,
      ContentType: 'image/webp',
    }),
  );
  return `${env.R2_PUBLIC_URL}/${key}`;
}
