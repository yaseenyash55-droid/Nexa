import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller.js';
import { validate } from '../middleware/validate.middleware.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { authRateLimiter, loginRateLimiter, accountCreationRateLimiter } from '../middleware/rateLimit.middleware.js';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  resendVerificationSchema
} from '../schemas/auth.schema.js';

const router = Router();
const controller = new AuthController();

router.post('/register', accountCreationRateLimiter, validate(registerSchema), (req, res, next) => controller.register(req, res, next));
router.post('/login', loginRateLimiter, validate(loginSchema), (req, res, next) => controller.login(req, res, next));
router.post('/refresh', authRateLimiter, (req, res, next) => controller.refresh(req, res, next));
router.post('/logout', (req, res, next) => controller.logout(req, res, next));
router.get('/me', requireAuth, (req, res, next) => controller.me(req, res, next));

router.post('/forgot-password', authRateLimiter, validate(forgotPasswordSchema), (req, res, next) => controller.forgotPassword(req, res, next));
router.post('/reset-password', authRateLimiter, validate(resetPasswordSchema), (req, res, next) => controller.resetPassword(req, res, next));
router.post('/verify-email', authRateLimiter, (req, res, next) => controller.verifyEmail(req, res, next));
router.post('/resend-verification', authRateLimiter, validate(resendVerificationSchema), (req, res, next) => controller.resendVerification(req, res, next));

export default router;

