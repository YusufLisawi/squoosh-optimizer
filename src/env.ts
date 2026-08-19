function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export const env = {
  CONVEX_URL: required('CONVEX_URL'),
  R2_ACCOUNT_ID: required('R2_ACCOUNT_ID'),
  R2_ACCESS_KEY_ID: required('R2_ACCESS_KEY_ID'),
  R2_SECRET_ACCESS_KEY: required('R2_SECRET_ACCESS_KEY'),
  R2_BUCKET_NAME: required('R2_BUCKET_NAME'),
  R2_PUBLIC_URL: required('R2_PUBLIC_URL').replace(/\/$/, ''),
  R2_ENDPOINT: required('R2_ENDPOINT'),
  // Required only for the HTTP server (src/server.ts). The CLI (src/cli.ts)
  // never checks this, since it's invoked locally by a human, not over HTTP.
  TRIGGER_SECRET: process.env.TRIGGER_SECRET?.trim(),
  PORT: Number(process.env.PORT ?? 3000),
  WEBP_QUALITY: Number(process.env.WEBP_QUALITY ?? 80),
};
