import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import http from 'http';
import https from 'https';
import { env } from '../config/env.js';

export type UploadKind = 'avatar' | 'photo' | 'story' | 'reel' | 'video' | 'chat';

export const MiB = 1024 * 1024;

export const MAX_BYTES: Record<UploadKind, number> = {
  avatar: 10 * MiB,
  photo: 20 * MiB,
  story: 100 * MiB,
  reel: 500 * MiB,
  video: 500 * MiB,
  chat: 50 * MiB
};

export const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov',
  'video/x-matroska': '.mkv'
};

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
  storeMedia(
    tempFilePath: string,
    originalName: string,
    mimeType: string,
    userId: number,
    kind: UploadKind
  ): Promise<MediaAssetMetadata>;
  deleteMedia(storageKey: string): Promise<boolean>;
  cleanupOrphans(maxAgeMs?: number): Promise<number>;
}

export class LocalDiskMediaStorageProvider implements IMediaStorageProvider {
  private uploadsDir: string;
  private tmpDir: string;

  constructor() {
    this.uploadsDir = path.resolve(process.cwd(), 'uploads');
    this.tmpDir = path.join(this.uploadsDir, '.tmp');
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
    if (!fs.existsSync(this.tmpDir)) {
      fs.mkdirSync(this.tmpDir, { recursive: true });
    }
  }

  async storeMedia(
    tempFilePath: string,
    originalName: string,
    mimeType: string,
    userId: number,
    _kind: UploadKind
  ): Promise<MediaAssetMetadata> {
    const assetId = crypto.randomUUID();
    const ext = MIME_EXTENSIONS[mimeType] || path.extname(originalName) || '.bin';
    const storageKey = `${assetId}${ext}`;
    const destinationPath = path.join(this.uploadsDir, storageKey);

    // Atomic move from temporary directory to permanent upload path
    await fs.promises.rename(tempFilePath, destinationPath);

    const stats = await fs.promises.stat(destinationPath);
    const mediaType = mimeType.startsWith('video/') ? 'video' : 'image';

    return {
      assetId,
      userId,
      originalName,
      storageKey,
      mimeType,
      sizeBytes: stats.size,
      mediaType,
      publicUrl: `/uploads/${storageKey}`,
      createdAt: new Date().toISOString()
    };
  }

  async deleteMedia(storageKey: string): Promise<boolean> {
    try {
      const sanitizedKey = path.basename(storageKey);
      const filePath = path.join(this.uploadsDir, sanitizedKey);
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  async cleanupOrphans(maxAgeMs = 60 * 60 * 1000): Promise<number> {
    let cleaned = 0;
    try {
      if (!fs.existsSync(this.tmpDir)) return 0;
      const files = await fs.promises.readdir(this.tmpDir);
      const cutoff = Date.now() - maxAgeMs;

      for (const file of files) {
        const filePath = path.join(this.tmpDir, file);
        try {
          const stats = await fs.promises.stat(filePath);
          if (stats.mtimeMs < cutoff) {
            await fs.promises.unlink(filePath);
            cleaned++;
          }
        } catch {
          // ignore individual stat/unlink errors
        }
      }
    } catch {
      // ignore directory readdir errors
    }
    return cleaned;
  }
}

export class S3CompatibleMediaStorageProvider implements IMediaStorageProvider {
  private endpoint: string;
  private bucket: string;
  private region: string;
  private accessKeyId: string;
  private secretAccessKey: string;
  private fallbackLocal: LocalDiskMediaStorageProvider;

  constructor(config: {
    endpoint?: string;
    bucket?: string;
    region?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
  }) {
    this.endpoint = config.endpoint || process.env.S3_ENDPOINT || process.env.OCI_OBJECT_STORAGE_ENDPOINT || '';
    this.bucket = config.bucket || process.env.S3_BUCKET || process.env.OCI_BUCKET_NAME || '';
    this.region = config.region || process.env.S3_REGION || 'us-ashburn-1';
    this.accessKeyId = config.accessKeyId || process.env.S3_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID || '';
    this.secretAccessKey = config.secretAccessKey || process.env.S3_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY || '';
    this.fallbackLocal = new LocalDiskMediaStorageProvider();
  }

  async storeMedia(
    tempFilePath: string,
    originalName: string,
    mimeType: string,
    userId: number,
    kind: UploadKind
  ): Promise<MediaAssetMetadata> {
    if (!this.bucket || !this.endpoint) {
      return this.fallbackLocal.storeMedia(tempFilePath, originalName, mimeType, userId, kind);
    }

    const assetId = crypto.randomUUID();
    const ext = MIME_EXTENSIONS[mimeType] || path.extname(originalName) || '.bin';
    const storageKey = `media/${kind}/${assetId}${ext}`;

    const fileStream = fs.createReadStream(tempFilePath);
    const stats = await fs.promises.stat(tempFilePath);

    // Stream file to S3-compatible endpoint via HTTP/HTTPS PUT
    await new Promise<void>((resolve, reject) => {
      const url = new URL(`${this.endpoint.replace(/\/$/, '')}/${this.bucket}/${storageKey}`);
      const isHttps = url.protocol === 'https:';
      const client = isHttps ? https : http;

      const req = client.request(
        url,
        {
          method: 'PUT',
          headers: {
            'Content-Type': mimeType,
            'Content-Length': stats.size,
            'x-amz-acl': 'public-read'
          }
        },
        (res) => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve();
          } else {
            reject(new Error(`S3 upload failed with HTTP status ${res.statusCode}`));
          }
        }
      );

      req.on('error', (err) => reject(err));
      fileStream.pipe(req);
    }).finally(async () => {
      // Remove local temp file after streaming to S3
      await fs.promises.unlink(tempFilePath).catch(() => undefined);
    });

    const publicUrl = `${this.endpoint.replace(/\/$/, '')}/${this.bucket}/${storageKey}`;
    const mediaType = mimeType.startsWith('video/') ? 'video' : 'image';

    return {
      assetId,
      userId,
      originalName,
      storageKey,
      mimeType,
      sizeBytes: stats.size,
      mediaType,
      publicUrl,
      createdAt: new Date().toISOString()
    };
  }

  async deleteMedia(storageKey: string): Promise<boolean> {
    if (!this.bucket || !this.endpoint) {
      return this.fallbackLocal.deleteMedia(storageKey);
    }
    try {
      const url = new URL(`${this.endpoint.replace(/\/$/, '')}/${this.bucket}/${storageKey}`);
      const isHttps = url.protocol === 'https:';
      const client = isHttps ? https : http;

      return await new Promise<boolean>((resolve) => {
        const req = client.request(url, { method: 'DELETE' }, (res) => {
          resolve(Boolean(res.statusCode && res.statusCode >= 200 && res.statusCode < 300));
        });
        req.on('error', () => resolve(false));
        req.end();
      });
    } catch {
      return false;
    }
  }

  async cleanupOrphans(maxAgeMs?: number): Promise<number> {
    return this.fallbackLocal.cleanupOrphans(maxAgeMs);
  }
}

let activeStorageProvider: IMediaStorageProvider | null = null;

export function getMediaStorageProvider(): IMediaStorageProvider {
  if (activeStorageProvider) return activeStorageProvider;

  const s3Endpoint = process.env.S3_ENDPOINT || process.env.OCI_OBJECT_STORAGE_ENDPOINT;
  const s3Bucket = process.env.S3_BUCKET || process.env.OCI_BUCKET_NAME;

  if (s3Endpoint && s3Bucket) {
    activeStorageProvider = new S3CompatibleMediaStorageProvider({
      endpoint: s3Endpoint,
      bucket: s3Bucket
    });
  } else {
    activeStorageProvider = new LocalDiskMediaStorageProvider();
  }

  return activeStorageProvider;
}

export function setMediaStorageProvider(provider: IMediaStorageProvider | null) {
  activeStorageProvider = provider;
}

/**
 * Validates real magic bytes from the initial slice of a file
 */
export function validateMagicBytes(buffer: Buffer, mimeType: string): boolean {
  if (buffer.length < 4) return false;
  const hex = buffer.toString('hex', 0, 4).toUpperCase();

  // JPEG / JPG: FF D8 FF
  if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
    return hex.startsWith('FFD8FF');
  }
  // PNG: 89 50 4E 47
  if (mimeType === 'image/png') {
    return hex === '89504E47';
  }
  // GIF: GIF87a or GIF89a (47 49 46 38)
  if (mimeType === 'image/gif') {
    return hex.startsWith('47494638');
  }
  // WebP: RIFF at byte 0..3 and WEBP at byte 8..11
  if (mimeType === 'image/webp') {
    if (buffer.length < 12) return false;
    const isRiff = buffer.toString('utf8', 0, 4) === 'RIFF';
    const isWebp = buffer.toString('utf8', 8, 12) === 'WEBP';
    return isRiff && isWebp;
  }
  // MP4 / QuickTime: 'ftyp' at bytes 4..7 or box signatures
  if (mimeType === 'video/mp4' || mimeType === 'video/quicktime') {
    if (buffer.length >= 8 && buffer.toString('utf8', 4, 8) === 'ftyp') return true;
    if (hex.startsWith('000000')) return true; // Box header
  }
  // WebM / MKV: EBML header 1A 45 DF A3
  if (mimeType === 'video/webm' || mimeType === 'video/x-matroska') {
    return hex === '1A45DFA3';
  }

  return false;
}
