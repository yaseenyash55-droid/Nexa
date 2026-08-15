import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller.js';
import { validate } from '../middleware/validate.middleware.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { authRateLimiter } from '../middleware/rateLimit.middleware.js';
import { registerSchema, loginSchema } from '../schemas/auth.schema.js';

const router = Router();
const controller = new AuthController();

router.post('/register', authRateLimiter, validate(registerSchema), (req, res, next) => controller.register(req, res, next));
router.post('/login', authRateLimiter, validate(loginSchema), (req, res, next) => controller.login(req, res, next));
router.post('/refresh', authRateLimiter, (req, res, next) => controller.refresh(req, res, next));
router.post('/logout', (req, res, next) => controller.logout(req, res, next));
router.get('/me', requireAuth, (req, res, next) => controller.me(req, res, next));

export default router;
