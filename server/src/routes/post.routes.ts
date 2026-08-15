import { Router } from 'express';
import { PostController } from '../controllers/post.controller.js';
import { requireAuth, optionalAuth } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { createPostSchema } from '../schemas/post.schema.js';
import { createCommentSchema } from '../schemas/comment.schema.js';

const router = Router();
const controller = new PostController();

router.get('/feed', optionalAuth, (req, res, next) => controller.getFeed(req, res, next));
router.get('/bookmarks', requireAuth, (req, res, next) => controller.getUserBookmarks(req, res, next));

router.post('/create', requireAuth, validate(createPostSchema), (req, res, next) => controller.createPost(req, res, next));
router.get('/:id', optionalAuth, (req, res, next) => controller.getPostById(req, res, next));
router.put('/:id', requireAuth, (req, res, next) => controller.updatePost(req, res, next));
router.delete('/:id', requireAuth, (req, res, next) => controller.deletePost(req, res, next));

router.post('/:id/like', requireAuth, (req, res, next) => controller.likePost(req, res, next));
router.delete('/:id/like', requireAuth, (req, res, next) => controller.unlikePost(req, res, next));

router.post('/:id/bookmark', requireAuth, (req, res, next) => controller.bookmarkPost(req, res, next));
router.delete('/:id/bookmark', requireAuth, (req, res, next) => controller.unbookmarkPost(req, res, next));

router.get('/:id/comments', (req, res, next) => controller.getPostComments(req, res, next));
router.post('/:id/comment', requireAuth, validate(createCommentSchema), (req, res, next) => controller.addComment(req, res, next));
router.delete('/:postId/comments/:commentId', requireAuth, (req, res, next) => controller.deleteComment(req, res, next));

export default router;
