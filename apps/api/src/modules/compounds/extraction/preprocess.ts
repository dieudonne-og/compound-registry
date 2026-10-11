import sharp from 'sharp';

const TARGET_WIDTH = 2000;

/**
 * Prepares an image for OCR: honours EXIF rotation, upscales small photos, and converts to
 * normalised greyscale. Luminance greyscale turns yellow watermarks and pastel backgrounds
 * near-white while dark text stays dark; Tesseract binarises internally.
 */
export async function prepareForOcr(image: Buffer): Promise<Buffer> {
  const rotated = sharp(image, { failOn: 'none' }).rotate();
  const { width = TARGET_WIDTH } = await sharp(await rotated.clone().toBuffer()).metadata();
  const scale = width < TARGET_WIDTH ? Math.min(4, TARGET_WIDTH / width) : 1;
  return rotated
    .resize({ width: Math.round(width * scale), kernel: 'lanczos3' })
    .greyscale()
    .normalise()
    .sharpen()
    .png()
    .toBuffer();
}

/**
 * Extra preparations tried when the standard one reads poorly, e.g. phone photos of LCD screens:
 * median filtering removes moiré, and the red channel makes blue display text darkest.
 */
export async function alternativePreparations(image: Buffer): Promise<Buffer[]> {
  const { width = TARGET_WIDTH } = await sharp(image, { failOn: 'none' }).metadata();
  const base = () =>
    sharp(image, { failOn: 'none' })
      .rotate()
      .resize({ width: Math.max(TARGET_WIDTH, width), kernel: 'lanczos3' });
  return Promise.all([
    base().greyscale().median(5).normalise().threshold(160).png().toBuffer(),
    base().extractChannel('red').median(7).normalise().sharpen().png().toBuffer(),
    base().extractChannel('red').median(5).normalise().threshold(150).png().toBuffer(),
    base().greyscale().blur(2).normalise().threshold(170).png().toBuffer(),
  ]);
}
