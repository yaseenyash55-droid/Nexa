import { Router } from 'express';
import { UserController } from '../controllers/user.controller.js';
import { requireAuth, optionalAuth } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { updateProfileSchema } from '../schemas/user.schema.js';

import { NotificationController } from '../controllers/notification.controller.js';

const router = Router();
const controller = new UserController();
const notifController = new NotificationController();

router.get('/search', optionalAuth, (req, res, next) => controller.searchUsers(req, res, next));
router.get('/suggestions', requireAuth, (req, res, next) => controller.getSuggestions(req, res, next));
router.get('/username/:username', optionalAuth, (req, res, next) => controller.getProfileByUsername(req, res, next));
router.get('/:id', optionalAuth, (req, res, next) => controller.getProfileById(req, res, next));
router.put('/:id', requireAuth, validate(updateProfileSchema), (req, res, next) => controller.updateProfile(req, res, next));

router.post('/fcm-token', requireAuth, (req, res, next) => notifController.registerFcmToken(req, res, next));
router.delete('/fcm-token', requireAuth, (req, res, next) => notifController.revokeFcmToken(req, res, next));

router.post('/:id/follow', requireAuth, (req, res, next) => controller.followUser(req, res, next));
router.delete('/:id/follow', requireAuth, (req, res, next) => controller.unfollowUser(req, res, next));
router.get('/:id/followers', optionalAuth, (req, res, next) => controller.getFollowers(req, res, next));
router.get('/:id/following', optionalAuth, (req, res, next) => controller.getFollowing(req, res, next));

export default router;
