import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { Router } from 'express';
import multer from 'multer';
import { executeSql } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { AuthenticatedRequest } from '../types/index.js';
import { validateMagicBytes } from '../services/media.service.js';
import { sendError, sendSuccess } from '../utils/response.js';

type UploadKind = 'avatar' | 'photo' | 'story' | 'reel' | 'chat';

const MiB = 1024 * 1024;
const MAX_BYTES: Record<UploadKind, number> = {
  avatar: 10 * MiB,
  photo: 20 * MiB,
  story: 100 * MiB,
  reel: 500 * MiB,
  chat: 50 * MiB
};
const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'video/mp4': '.mp4',
  'video/webm': '.webm'
};

const uploadRoot = path.resolve(process.cwd(), 'uploads');
const temporaryRoot = path.join(uploadRoot, '.tmp');
fs.mkdirSync(temporaryRoot, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: temporaryRoot,
    filename: (_request, _file, callback) => callback(null, crypto.randomUUID())
  }),
  limits: { files: 1, fileSize: MAX_BYTES.reel },
  fileFilter: (_request, file, callback) => callback(null, Boolean(MIME_EXTENSIONS[file.mimetype]))
});

async function removeIfPresent(filePath?: string): Promise<void> {
  if (!filePath) return;
  await fs.promises.unlink(filePath).catch(() => undefined);
}

import { aiAndMediaRateLimiter } from '../middleware/rateLimit.middleware.js';

export const mediaRouter = Router();

mediaRouter.post('/upload', requireAuth, aiAndMediaRateLimiter, upload.single('file'), async (req, res, next) => {
  const uploaded = req.file;
  let finalPath: string | undefined;
  try {
    if (!uploaded) return sendError(res, 'FILE_REQUIRED', 'Choose one supported image or video file', 400);

    const kind = String(req.body.kind || '') as UploadKind;
    if (!(kind in MAX_BYTES)) {
      await removeIfPresent(uploaded.path);
      return sendError(res, 'INVALID_MEDIA_KIND', 'Upload kind is invalid', 400);
    }
    if (uploaded.size > MAX_BYTES[kind]) {
      await removeIfPresent(uploaded.path);
      return sendError(res, 'FILE_TOO_LARGE', `Maximum ${kind} size is ${MAX_BYTES[kind] / MiB} MiB`, 413);
    }
    if (kind === 'reel' && !uploaded.mimetype.startsWith('video/')) {
      await removeIfPresent(uploaded.path);
      return sendError(res, 'INVALID_MEDIA_TYPE', 'Reels require an MP4 or WebM video', 415);
    }

    const handle = await fs.promises.open(uploaded.path, 'r');
    const signature = Buffer.alloc(16);
    await handle.read(signature, 0, signature.length, 0);
    await handle.close();
    if (!validateMagicBytes(signature, uploaded.mimetype)) {
      await removeIfPresent(uploaded.path);
      return sendError(res, 'INVALID_FILE_SIGNATURE', 'The file content does not match its media type', 415);
    }

    const assetId = crypto.randomUUID();
    const storageKey = `${assetId}${MIME_EXTENSIONS[uploaded.mimetype]}`;
    finalPath = path.join(uploadRoot, storageKey);
    await fs.promises.rename(uploaded.path, finalPath);

    const authReq = req as AuthenticatedRequest;
    try {
      await executeSql(
        `INSERT INTO MEDIA_ASSETS
           (ASSET_ID, USER_ID, STORAGE_KEY, ORIGINAL_NAME, MIME_TYPE, SIZE_BYTES, MEDIA_KIND)
         VALUES
           (:assetId, :userId, :storageKey, :originalName, :mimeType, :sizeBytes, :mediaKind)`,
        {
          assetId,
          userId: authReq.user!.userId,
          storageKey,
          originalName: path.basename(uploaded.originalname).slice(0, 255),
          mimeType: uploaded.mimetype,
          sizeBytes: uploaded.size,
          mediaKind: kind.toUpperCase()
        }
      );
    } catch (error) {
      await removeIfPresent(finalPath);
      throw error;
    }

    return sendSuccess(
      res,
      {
        assetId,
        mediaKind: kind,
        mimeType: uploaded.mimetype,
        sizeBytes: uploaded.size,
        publicUrl: `/uploads/${storageKey}`
      },
      'Media uploaded',
      undefined,
      201
    );
  } catch (error) {
    await removeIfPresent(uploaded?.path);
    next(error);
  }
});
