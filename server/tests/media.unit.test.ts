import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  validateMagicBytes,
  LocalDiskMediaStorageProvider,
  S3CompatibleMediaStorageProvider,
  MAX_BYTES,
  MiB
} from '../src/services/media.service.js';
import {
  normalizeStorageProvider,
  validateStorageConfiguration
} from '../src/config/env.js';
import fs from 'fs';
import path from 'path';

describe('Media Service & Storage Engine Suite', () => {
  describe('Magic Byte Signature Verification', () => {
    it('validates genuine JPEG magic bytes (FF D8 FF)', () => {
      const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
      expect(validateMagicBytes(jpegBuffer, 'image/jpeg')).toBe(true);
      expect(validateMagicBytes(jpegBuffer, 'image/png')).toBe(false);
    });

    it('validates genuine PNG magic bytes (89 50 4E 47)', () => {
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      expect(validateMagicBytes(pngBuffer, 'image/png')).toBe(true);
      expect(validateMagicBytes(pngBuffer, 'image/jpeg')).toBe(false);
    });

    it('validates genuine GIF magic bytes (GIF87a / GIF89a)', () => {
      const gifBuffer = Buffer.from('GIF89a');
      expect(validateMagicBytes(gifBuffer, 'image/gif')).toBe(true);
    });

    it('validates genuine WebP magic bytes (RIFF....WEBP)', () => {
      const webpBuffer = Buffer.concat([
        Buffer.from('RIFF'),
        Buffer.from([0x00, 0x00, 0x00, 0x00]),
        Buffer.from('WEBP')
      ]);
      expect(validateMagicBytes(webpBuffer, 'image/webp')).toBe(true);
    });

    it('validates genuine MP4 video headers with ftyp box', () => {
      const mp4Buffer = Buffer.concat([
        Buffer.from([0x00, 0x00, 0x00, 0x20]),
        Buffer.from('ftypisom')
      ]);
      expect(validateMagicBytes(mp4Buffer, 'video/mp4')).toBe(true);
    });

    it('validates genuine WebM video EBML headers (1A 45 DF A3)', () => {
      const webmBuffer = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81]);
      expect(validateMagicBytes(webmBuffer, 'video/webm')).toBe(true);
    });

    it('rejects spoofed extensions with invalid magic bytes', () => {
      const spoofedTextFile = Buffer.from('This is a plain text file pretending to be an image');
      expect(validateMagicBytes(spoofedTextFile, 'image/jpeg')).toBe(false);
      expect(validateMagicBytes(spoofedTextFile, 'image/png')).toBe(false);
      expect(validateMagicBytes(spoofedTextFile, 'video/mp4')).toBe(false);
    });
  });

  describe('Media Kind Contract & Size Limits', () => {
    it('enforces maximum size constraints per media kind', () => {
      expect(MAX_BYTES.avatar).toBe(10 * MiB);
      expect(MAX_BYTES.photo).toBe(20 * MiB);
      expect(MAX_BYTES.story).toBe(100 * MiB);
      expect(MAX_BYTES.reel).toBe(500 * MiB);
      expect(MAX_BYTES.video).toBe(500 * MiB);
      expect(MAX_BYTES.chat).toBe(50 * MiB);
    });
  });

  describe('Storage Configuration & Production Rejection', () => {
    it('normalizes storage provider aliases', () => {
      expect(normalizeStorageProvider('s3')).toBe('s3');
      expect(normalizeStorageProvider('oci_object_storage')).toBe('s3');
      expect(normalizeStorageProvider('s3_compatible')).toBe('s3');
      expect(normalizeStorageProvider('local')).toBe('local');
      expect(normalizeStorageProvider('disk')).toBe('local');
    });

    it('rejects local disk storage in production mode', () => {
      expect(() => validateStorageConfiguration('local', true)).toThrow(
        /Local disk storage provider is not permitted in production/
      );
    });

    it('permits local disk storage in development mode', () => {
      expect(() => validateStorageConfiguration('local', false)).not.toThrow();
    });

    it('rejects incomplete S3 configuration in production mode', () => {
      const originalEnv = { ...process.env };
      delete process.env.S3_ENDPOINT;
      delete process.env.S3_BUCKET;
      delete process.env.S3_ACCESS_KEY_ID;
      delete process.env.S3_SECRET_ACCESS_KEY;

      expect(() => validateStorageConfiguration('s3', true)).toThrow(
        /Missing required persistent storage configuration/
      );

      process.env = originalEnv;
    });

    it('accepts complete S3 configuration in production mode', () => {
      const originalEnv = { ...process.env };
      process.env.S3_ENDPOINT = 'https://s3.example.com';
      process.env.S3_BUCKET = 'nexa-media';
      process.env.S3_ACCESS_KEY_ID = 'access-key-123';
      process.env.S3_SECRET_ACCESS_KEY = 'secret-key-456';

      expect(() => validateStorageConfiguration('s3', true)).not.toThrow();

      process.env = originalEnv;
    });
  });

  describe('Local Storage Provider & Orphan Cleanup', () => {
    const testDir = path.resolve(process.cwd(), 'uploads', '.tmp');

    beforeEach(() => {
      if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
      }
    });

    it('cleans up orphaned temp files older than maxAge', async () => {
      const provider = new LocalDiskMediaStorageProvider();
      const oldTempFile = path.join(testDir, `test-orphan-${Date.now()}.tmp`);
      await fs.promises.writeFile(oldTempFile, 'temporary upload data');

      // Backdate file modification time by 2 hours
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      await fs.promises.utimes(oldTempFile, twoHoursAgo, twoHoursAgo);

      const cleanedCount = await provider.cleanupOrphans(1 * 60 * 60 * 1000);
      expect(cleanedCount).toBeGreaterThanOrEqual(1);
      expect(fs.existsSync(oldTempFile)).toBe(false);
    });

    it('stores media and generates sanitized storage keys', async () => {
      const provider = new LocalDiskMediaStorageProvider();
      const tempUpload = path.join(testDir, `test-upload-${Date.now()}.jpg`);
      await fs.promises.writeFile(tempUpload, Buffer.from([0xff, 0xd8, 0xff, 0xe0]));

      const asset = await provider.storeMedia(
        tempUpload,
        'profile_photo.jpg',
        'image/jpeg',
        1,
        'photo'
      );

      expect(asset.assetId).toBeDefined();
      expect(asset.storageKey.endsWith('.jpg')).toBe(true);
      expect(asset.publicUrl).toBe(`/uploads/${asset.storageKey}`);
      expect(asset.mediaType).toBe('image');

      // Cleanup
      await provider.deleteMedia(asset.storageKey);
    });
  });

  describe('S3 Compatible Storage Provider Suite', () => {
    const testDir = path.resolve(process.cwd(), 'uploads', '.tmp');

    beforeEach(() => {
      if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
      }
    });

    it('streams file to S3 and returns asset metadata without public-read ACL', async () => {
      const mockSend = vi.fn().mockResolvedValue({});
      const mockS3Client = { send: mockSend } as any;

      const provider = new S3CompatibleMediaStorageProvider({
        endpoint: 'https://ax192837.compat.objectstorage.us-ashburn-1.oraclecloud.com',
        bucket: 'nexa-prod-media',
        region: 'us-ashburn-1',
        accessKeyId: 'test-key',
        secretAccessKey: 'test-secret',
        cdnBaseUrl: 'https://cdn.nexa.app',
        s3Client: mockS3Client
      });

      const tempFile = path.join(testDir, `s3-upload-${Date.now()}.png`);
      await fs.promises.writeFile(tempFile, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));

      const asset = await provider.storeMedia(
        tempFile,
        'avatar.png',
        'image/png',
        42,
        'avatar'
      );

      expect(mockSend).toHaveBeenCalledTimes(1);
      const commandArg = mockSend.mock.calls[0][0];
      expect(commandArg.input.Bucket).toBe('nexa-prod-media');
      expect(commandArg.input.Key).toContain('media/avatar/');
      expect(commandArg.input.Key.endsWith('.png')).toBe(true);
      expect(commandArg.input.ContentType).toBe('image/png');
      expect(commandArg.input.ACL).toBeUndefined(); // Must not use public-read automatically

      expect(asset.publicUrl).toBe(`https://cdn.nexa.app/${asset.storageKey}`);
      expect(asset.userId).toBe(42);
      expect(asset.mediaType).toBe('image');
      expect(fs.existsSync(tempFile)).toBe(false); // Staging temp file unlinked
    });

    it('deletes stored object via authenticated S3 DeleteObjectCommand', async () => {
      const mockSend = vi.fn().mockResolvedValue({});
      const mockS3Client = { send: mockSend } as any;

      const provider = new S3CompatibleMediaStorageProvider({
        endpoint: 'https://s3.example.com',
        bucket: 'nexa-bucket',
        accessKeyId: 'key',
        secretAccessKey: 'secret',
        s3Client: mockS3Client
      });

      const success = await provider.deleteMedia('media/photo/12345.jpg');
      expect(success).toBe(true);
      expect(mockSend).toHaveBeenCalledTimes(1);
      const commandArg = mockSend.mock.calls[0][0];
      expect(commandArg.input.Bucket).toBe('nexa-bucket');
      expect(commandArg.input.Key).toBe('media/photo/12345.jpg');
    });

    it('falls back to S3 endpoint URL when CDN_BASE_URL is not set', async () => {
      const mockSend = vi.fn().mockResolvedValue({});
      const mockS3Client = { send: mockSend } as any;

      const provider = new S3CompatibleMediaStorageProvider({
        endpoint: 'https://s3.us-ashburn-1.oraclecloud.com',
        bucket: 'nexa-direct-bucket',
        cdnBaseUrl: '',
        s3Client: mockS3Client
      });

      const tempFile = path.join(testDir, `s3-direct-${Date.now()}.mp4`);
      await fs.promises.writeFile(tempFile, Buffer.from([0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70]));

      const asset = await provider.storeMedia(
        tempFile,
        'video.mp4',
        'video/mp4',
        7,
        'reel'
      );

      expect(asset.publicUrl).toBe(`https://s3.us-ashburn-1.oraclecloud.com/nexa-direct-bucket/${asset.storageKey}`);
      expect(asset.mediaType).toBe('video');
    });
  });
});
