import sharp from 'sharp';

export const SUPPORTED_FORMATS = ['webp', 'avif', 'jpeg', 'png'] as const;
export type OutputFormat = (typeof SUPPORTED_FORMATS)[number];

export function isSupportedFormat(value: string): value is OutputFormat {
  return (SUPPORTED_FORMATS as readonly string[]).includes(value);
}

export type ConvertResult = {
  bytes: Buffer;
  contentType: string;
  bytesBefore: number;
  bytesAfter: number;
};

/**
 * Re-encode one image. Stateless — no upload, no database, nothing kept
 * after the response. This is the generic "shrink my image" primitive; the
 * TinyTales-specific batch pipeline in optimize.ts is a separate concern
 * layered on top of it, not the other way around.
 */
export async function convertImage(
  input: Buffer,
  format: OutputFormat,
  quality: number,
): Promise<ConvertResult> {
  const pipeline = sharp(input);
  const bytes = await (format === 'png' ? pipeline.png() : pipeline[format]({ quality })).toBuffer();

  return {
    bytes,
    contentType: `image/${format}`,
    bytesBefore: input.byteLength,
    bytesAfter: bytes.byteLength,
  };
}
