import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { inspectUpload } from './intake';

const fixture = (name: string) =>
  readFileSync(new URL(`../../../../test/fixtures/reports/${name}`, import.meta.url));

describe('inspectUpload', () => {
  it('accepts PDFs and JPEGs by content, whatever the extension case', async () => {
    await expect(inspectUpload(fixture('analysis-certificate-text.pdf'), 'Report.PDF')).resolves.toEqual({
      mime: 'application/pdf',
      ext: 'pdf',
    });
    await expect(inspectUpload(fixture('xrf-screen-photo.jpg'), 'screen.jpeg')).resolves.toEqual({
      mime: 'image/jpeg',
      ext: 'jpg',
    });
  });
  it('rejects a PNG renamed to .pdf', async () => {
    const png = await sharp({ create: { width: 4, height: 4, channels: 3, background: '#fff' } })
      .png()
      .toBuffer();
    await expect(inspectUpload(png, 'report.pdf')).rejects.toMatchObject({
      code: 'UNSUPPORTED_FILE_TYPE',
      status: 415,
    });
  });
  it('rejects text pretending to be an image', async () => {
    await expect(inspectUpload(Buffer.from('hello world'), 'photo.jpg')).rejects.toMatchObject({
      code: 'UNSUPPORTED_FILE_TYPE',
    });
  });
  it('rejects formats outside the allowed list', async () => {
    const gif = Buffer.from('R0lGODlhAQABAIAAAP///wAAACwAAAAAAQABAAACAkQBADs=', 'base64');
    await expect(inspectUpload(gif, 'scan.gif')).rejects.toMatchObject({ code: 'UNSUPPORTED_FILE_TYPE' });
  });
});
