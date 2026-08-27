import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { musicLicensingService } from '../services/music.service.js';
import { spotifyService } from '../services/spotify.service.js';
import { sendSuccess, sendError } from '../utils/response.js';

export const musicRouter = Router();

musicRouter.get('/catalog', async (req, res, next) => {
  try {
    const query = req.query.q as string | undefined;
    const tracks = musicLicensingService.searchLicensedCatalog(query);
    return sendSuccess(res, tracks);
  } catch (err) {
    next(err);
  }
});

musicRouter.post('/validate', requireAuth, async (req: any, res, next) => {
  try {
    const { trackId, isCommercial } = req.body;
    if (!trackId) {
      return sendError(res, 'INVALID_INPUT', 'trackId is required', 400);
    }
    const result = musicLicensingService.validateTrackForEditing(trackId, Boolean(isCommercial));
    if (!result.allowed) {
      return sendError(res, 'LICENSE_REJECTED', result.reason || 'Licensing validation failed', 403);
    }
    return sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
});

musicRouter.get('/spotify/search', async (req, res, next) => {
  try {
    const query = (req.query.q as string) || '';
    const tracks = await spotifyService.searchTracks(query);
    return sendSuccess(res, tracks);
  } catch (err) {
    next(err);
  }
});

musicRouter.get('/spotify/track/:id', async (req, res, next) => {
  try {
    const trackId = req.params.id;
    const track = await spotifyService.getTrackDetails(trackId);
    if (!track) {
      return sendError(res, 'NOT_FOUND', 'Track not found', 404);
    }
    return sendSuccess(res, track);
  } catch (err) {
    next(err);
  }
});
