import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
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
  getSignedDeliveryUrl?(storageKey: string, expiresInSeconds?: number): Promise<string>;
}

export class LocalDiskMediaStorageProvider implements IMediaStorageProvider {
  private uploadsDir: string;
  private tmpDir: string;

  constructor() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        '[FATAL CONFIGURATION ERROR] LocalDiskMediaStorageProvider cannot be instantiated in production.'
      );
    }
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

export interface S3StorageConfig {
  endpoint?: string;
  bucket?: string;
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  cdnBaseUrl?: string;
  s3Client?: S3Client;
}

export class S3CompatibleMediaStorageProvider implements IMediaStorageProvider {
  private endpoint: string;
  private bucket: string;
  private region: string;
  private accessKeyId: string;
  private secretAccessKey: string;
  private cdnBaseUrl: string;
  private s3Client: S3Client;
  private tmpDir: string;

  constructor(config: S3StorageConfig = {}) {
    this.endpoint = config.endpoint || env.S3_ENDPOINT || process.env.S3_ENDPOINT || process.env.OCI_OBJECT_STORAGE_ENDPOINT || '';
    this.bucket = config.bucket || env.S3_BUCKET || process.env.S3_BUCKET || process.env.OCI_BUCKET_NAME || '';
    this.region = config.region || env.S3_REGION || process.env.S3_REGION || 'us-ashburn-1';
    this.accessKeyId = config.accessKeyId || env.S3_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID || '';
    this.secretAccessKey = config.secretAccessKey || env.S3_SECRET_ACCESS_KEY || process.env.S3_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY || '';
    this.cdnBaseUrl = config.cdnBaseUrl || env.CDN_BASE_URL || process.env.CDN_BASE_URL || '';

    if (config.s3Client) {
      this.s3Client = config.s3Client;
    } else {
      this.s3Client = new S3Client({
        endpoint: this.endpoint || undefined,
        region: this.region,
        credentials: {
          accessKeyId: this.accessKeyId,
          secretAccessKey: this.secretAccessKey
        },
        forcePathStyle: true
      });
    }

    this.tmpDir = path.resolve(process.cwd(), 'uploads', '.tmp');
    if (!fs.existsSync(this.tmpDir)) {
      try {
        fs.mkdirSync(this.tmpDir, { recursive: true });
      } catch {
        // Ignore directory creation errors if read-only filesystem
      }
    }
  }

  async storeMedia(
    tempFilePath: string,
    originalName: string,
    mimeType: string,
    userId: number,
    kind: UploadKind
  ): Promise<MediaAssetMetadata> {
    if (!this.bucket || !this.endpoint) {
      throw new Error(
        '[STORAGE ERROR] Persistent S3/OCI storage is missing required endpoint or bucket configuration'
      );
    }

    const assetId = crypto.randomUUID();
    const ext = MIME_EXTENSIONS[mimeType] || path.extname(originalName) || '.bin';
    const storageKey = `media/${kind}/${assetId}${ext}`;

    const fileStream = fs.createReadStream(tempFilePath);
    const stats = await fs.promises.stat(tempFilePath);

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: storageKey,
        Body: fileStream,
        ContentType: mimeType,
        ContentLength: stats.size
      });

      await this.s3Client.send(command);
    } finally {
      // Always remove local temp file after streaming upload
      await fs.promises.unlink(tempFilePath).catch(() => undefined);
    }

    let publicUrl: string;
    if (this.cdnBaseUrl) {
      publicUrl = `${this.cdnBaseUrl.replace(/\/$/, '')}/${storageKey}`;
    } else {
      publicUrl = `${this.endpoint.replace(/\/$/, '')}/${this.bucket}/${storageKey}`;
    }

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

  async getSignedDeliveryUrl(storageKey: string, expiresInSeconds = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: storageKey
    });
    return getSignedUrl(this.s3Client, command, { expiresIn: expiresInSeconds });
  }

  async deleteMedia(storageKey: string): Promise<boolean> {
    if (!this.bucket) {
      return false;
    }
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: storageKey
      });
      await this.s3Client.send(command);
      return true;
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
          // ignore individual unlink errors
        }
      }
    } catch {
      // ignore directory errors
    }
    return cleaned;
  }
}

let activeStorageProvider: IMediaStorageProvider | null = null;

export function getMediaStorageProvider(): IMediaStorageProvider {
  if (activeStorageProvider) return activeStorageProvider;

  const providerType = env.STORAGE_PROVIDER || (process.env.NODE_ENV === 'production' ? 's3' : 'local');

  if (providerType === 's3') {
    activeStorageProvider = new S3CompatibleMediaStorageProvider();
  } else {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        '[FATAL CONFIGURATION ERROR] Local disk storage provider is not permitted in production. A persistent object storage provider (STORAGE_PROVIDER=s3) is required.'
      );
    }
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
