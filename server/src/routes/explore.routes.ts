import { Router } from 'express';
import { MockExploreService } from '../services/mockExploreService.js';
import { sendSuccess } from '../utils/response.js';

export const exploreRouter = Router();

exploreRouter.get('/mock', (req, res, next) => {
  try {
    const content = MockExploreService.getExploreContent();
    return sendSuccess(res, content, 'Mock explore content fetched successfully');
  } catch (err) {
    next(err);
  }
});
