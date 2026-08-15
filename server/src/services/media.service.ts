import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface MediaAssetMetadata {
  assetId: string;
  userId: number;
  originalName: string;
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  mediaType: 'image' | 'video';
  publicUrl: string;
  createdAt: string;
}

export interface IMediaStorageProvider {
  storeMedia(fileBuffer: Buffer, originalName: string, mimeType: string, userId: number): Promise<MediaAssetMetadata>;
  deleteMedia(storageKey: string): Promise<boolean>;
}

export class LocalDevelopmentMediaStorageProvider implements IMediaStorageProvider {
  private uploadsDir: string;

  constructor() {
    this.uploadsDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
  }

  async storeMedia(fileBuffer: Buffer, originalName: string, mimeType: string, userId: number): Promise<MediaAssetMetadata> {
    const assetId = crypto.randomUUID();
    const ext = path.extname(originalName) || '.bin';
    const storageKey = `${assetId}${ext}`;
    const filePath = path.join(this.uploadsDir, storageKey);

    await fs.promises.writeFile(filePath, fileBuffer);

    const mediaType = mimeType.startsWith('video/') ? 'video' : 'image';

    return {
      assetId,
      userId,
      originalName,
      storageKey,
      mimeType,
      sizeBytes: fileBuffer.length,
      mediaType,
      publicUrl: `/uploads/${storageKey}`,
      createdAt: new Date().toISOString()
    };
  }

  async deleteMedia(storageKey: string): Promise<boolean> {
    try {
      const filePath = path.join(this.uploadsDir, storageKey);
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }
}

export function validateMagicBytes(buffer: Buffer, mimeType: string): boolean {
  if (buffer.length < 4) return false;
  const hex = buffer.toString('hex', 0, 4).toUpperCase();

  if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
    return hex.startsWith('FFD8FF');
  }
  if (mimeType === 'image/png') {
    return hex === '89504E47';
  }
  if (mimeType === 'image/gif') {
    return hex.startsWith('47494638');
  }
  if (mimeType === 'image/webp') {
    return buffer.toString('utf8', 8, 12) === 'WEBP';
  }
  if (mimeType === 'video/mp4') {
    return buffer.toString('utf8', 4, 8) === 'ftyp' || hex.startsWith('000000');
  }
  if (mimeType === 'video/webm') {
    return hex === '1A45DFA3';
  }

  return false;
}
