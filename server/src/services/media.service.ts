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

export type UploadKind = 'avatar' | 'photo' | 'story' | 'reel' | 'video' | 'chat' | 'document';

export const MiB = 1024 * 1024;

export const MAX_BYTES: Record<UploadKind, number> = {
  avatar: 10 * MiB,
  photo: 20 * MiB,
  story: 100 * MiB,
  reel: 500 * MiB,
  video: 500 * MiB,
  chat: 50 * MiB,
  document: 20 * MiB
};

export const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov',
  'video/x-matroska': '.mkv',
  'application/pdf': '.pdf',
  'text/plain': '.txt',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx'
};

export interface MediaAssetMetadata {
  assetId: string;
  userId: number;
  originalName: string;
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  mediaType: 'image' | 'video' | 'file';
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
    const mediaType = mimeType.startsWith('video/') ? 'video' : (mimeType.startsWith('image/') ? 'image' : 'file');

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

    const mediaType = mimeType.startsWith('video/') ? 'video' : (mimeType.startsWith('image/') ? 'image' : 'file');

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

export async function verifyMediaOwnership(userId: number, mediaIds: string[]): Promise<boolean> {
  if (!mediaIds || mediaIds.length === 0) return true;

  // Dedup media ids and filter empty
  const uniqueIds = Array.from(new Set(mediaIds.filter(Boolean)));
  if (uniqueIds.length === 0) return true;

  try {
    if (env.DATABASE_PROVIDER === 'postgres') {
      const { executePostgresSql } = await import('../db/postgres.pool.js');
      const res = await executePostgresSql(
        `SELECT COUNT(*) as count FROM media_assets WHERE user_id = $1 AND asset_id = ANY($2::varchar[])`,
        [userId, uniqueIds]
      );
      return Number(res.rows[0].count) === uniqueIds.length;
    } else {
      const { executeSql } = await import('../db/pool.js');
      const inClause = uniqueIds.map((_, i) => `:id${i}`).join(',');
      const params: Record<string, any> = { userId };
      uniqueIds.forEach((id, i) => {
        params[`id${i}`] = id;
      });
      const res = await executeSql(
        `SELECT COUNT(*) as count FROM MEDIA_ASSETS WHERE USER_ID = :userId AND ASSET_ID IN (${inClause})`,
        params
      );
      return Number(res.rows?.[0]?.COUNT || res.rows?.[0]?.[0] || 0) === uniqueIds.length;
    }
  } catch (err) {
    console.error('[verifyMediaOwnership] Error:', err);
    return false;
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
  // PDF: %PDF- (25 50 44 46 2D)
  if (mimeType === 'application/pdf') {
    return buffer.toString('utf8', 0, 5) === '%PDF-';
  }
  // DOCX / ZIP: PK.. (50 4B 03 04)
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return hex === '504B0304';
  }
  // DOC (Old MS Word OLE): D0 CF 11 E0
  if (mimeType === 'application/msword') {
    return hex === 'D0CF11E0';
  }
  // TXT (Plain text has no magic bytes, allow text files)
  if (mimeType === 'text/plain') {
    // Only allow if the initial characters are valid ASCII/UTF-8 and not binary
    // Simple heuristic: check if first few bytes are valid text characters or whitespace
    for (let i = 0; i < Math.min(buffer.length, 10); i++) {
      const byte = buffer[i];
      if (byte < 9 || (byte > 13 && byte < 32)) return false; // Contains control characters (excluding tab/newline)
    }
    return true;
  }

  return false;
}
