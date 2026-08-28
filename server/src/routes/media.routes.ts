import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Router } from 'express';
import multer from 'multer';
import { executeSql } from '../db/pool.js';
import { executePostgresSql } from '../db/postgres.pool.js';
import { env } from '../config/env.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { AuthenticatedRequest } from '../types/index.js';
import {
  UploadKind,
  MAX_BYTES,
  MIME_EXTENSIONS,
  MiB,
  validateMagicBytes,
  getMediaStorageProvider
} from '../services/media.service.js';
import { sendError, sendSuccess } from '../utils/response.js';
import { aiAndMediaRateLimiter } from '../middleware/rateLimit.middleware.js';

const uploadRoot = path.resolve(process.cwd(), 'uploads');
const temporaryRoot = path.join(uploadRoot, '.tmp');
if (!fs.existsSync(temporaryRoot)) {
  fs.mkdirSync(temporaryRoot, { recursive: true });
}

const upload = multer({
  storage: multer.diskStorage({
    destination: temporaryRoot,
    filename: (_request, _file, callback) => callback(null, crypto.randomUUID())
  }),
  limits: { files: 1, fileSize: MAX_BYTES.reel },
  fileFilter: (_request, file, callback) => {
    // Basic MIME format check; deep inspection happens via magic bytes below
    callback(null, Boolean(MIME_EXTENSIONS[file.mimetype]));
  }
});

async function removeIfPresent(filePath?: string): Promise<void> {
  if (!filePath) return;
  await fs.promises.unlink(filePath).catch(() => undefined);
}

export const mediaRouter = Router();

mediaRouter.post(
  '/upload',
  requireAuth,
  aiAndMediaRateLimiter,
  upload.single('file'),
  async (req, res, next) => {
    const uploaded = req.file;
    if (!uploaded) {
      return sendError(res, 'FILE_REQUIRED', 'Choose one supported image, video, or document file', 400);
    }

    try {
      // Normalize kind parameter (client might send 'video', 'photo', 'reel', 'avatar', 'story', 'chat')
      const rawKind = String(req.body.kind || 'photo').toLowerCase();
      const kind: UploadKind = rawKind === 'video' ? 'reel' : (rawKind as UploadKind);

      if (!(kind in MAX_BYTES)) {
        await removeIfPresent(uploaded.path);
        return sendError(res, 'INVALID_MEDIA_KIND', 'Upload kind is invalid', 400);
      }

      if (uploaded.size > MAX_BYTES[kind]) {
        await removeIfPresent(uploaded.path);
        return sendError(
          res,
          'FILE_TOO_LARGE',
          `Maximum ${kind} size is ${MAX_BYTES[kind] / MiB} MiB`,
          413
        );
      }

      if ((kind === 'reel' || rawKind === 'video') && !uploaded.mimetype.startsWith('video/')) {
        await removeIfPresent(uploaded.path);
        return sendError(res, 'INVALID_MEDIA_TYPE', 'Reels and videos require an MP4, WebM or MOV video file', 415);
      }

      // Read magic bytes from initial slice of uploaded file
      const handle = await fs.promises.open(uploaded.path, 'r');
      const signature = Buffer.alloc(16);
      await handle.read(signature, 0, signature.length, 0);
      await handle.close();

      if (!validateMagicBytes(signature, uploaded.mimetype)) {
        await removeIfPresent(uploaded.path);
        return sendError(
          res,
          'INVALID_FILE_SIGNATURE',
          'The file content does not match its declared media type signature',
          415
        );
      }

      // Store via storage provider (S3 / OCI Object Storage or local disk streaming)
      const storageProvider = getMediaStorageProvider();
      const asset = await storageProvider.storeMedia(
        uploaded.path,
        uploaded.originalname,
        uploaded.mimetype,
        (req as AuthenticatedRequest).user!.userId,
        kind
      );

      // Record metadata and storage key in database
      const authReq = req as AuthenticatedRequest;
      try {
        if (env.DATABASE_PROVIDER === 'postgres') {
          await executePostgresSql(
            `INSERT INTO media_assets
               (asset_id, user_id, storage_key, original_name, mime_type, size_bytes, media_kind)
             VALUES
               ($1, $2, $3, $4, $5, $6, $7)`,
            [
              asset.assetId,
              authReq.user!.userId,
              asset.storageKey,
              path.basename(uploaded.originalname).slice(0, 255),
              uploaded.mimetype,
              asset.sizeBytes,
              kind.toUpperCase()
            ]
          );
        } else {
          await executeSql(
            `INSERT INTO MEDIA_ASSETS
               (ASSET_ID, USER_ID, STORAGE_KEY, ORIGINAL_NAME, MIME_TYPE, SIZE_BYTES, MEDIA_KIND)
             VALUES
               (:assetId, :userId, :storageKey, :originalName, :mimeType, :sizeBytes, :mediaKind)`,
            {
              assetId: asset.assetId,
              userId: authReq.user!.userId,
              storageKey: asset.storageKey,
              originalName: path.basename(uploaded.originalname).slice(0, 255),
              mimeType: uploaded.mimetype,
              sizeBytes: asset.sizeBytes,
              mediaKind: kind.toUpperCase()
            }
          );
        }
      } catch (dbError) {
        // Rollback stored object on DB insert failure
        await storageProvider.deleteMedia(asset.storageKey).catch(() => undefined);
        throw dbError;
      }

      return sendSuccess(
        res,
        {
          assetId: asset.assetId,
          mediaKind: kind,
          mimeType: uploaded.mimetype,
          sizeBytes: asset.sizeBytes,
          publicUrl: asset.publicUrl
        },
        'Media uploaded successfully',
        undefined,
        201
      );
    } catch (error) {
      await removeIfPresent(uploaded?.path);
      next(error);
    }
  }
);
