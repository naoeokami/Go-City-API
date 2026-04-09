// src/routes/post.routes.ts
import { Router } from 'express'
import {
  createPost, getFeed,
  toggleLike, addComment, getComments, deletePost, getExploreFeed
} from '../controllers/post.controller'
import { authMiddleware } from '../middlewares/auth.middleware'

const router = Router()

router.get('/feed',          authMiddleware, getFeed)
router.post('/',             authMiddleware, createPost)
router.post('/:id/like',     authMiddleware, toggleLike)
router.get('/:id/comments',  authMiddleware, getComments)
router.post('/:id/comments', authMiddleware, addComment)
router.delete('/:id',        authMiddleware, deletePost)
router.get('/explore',       authMiddleware, getExploreFeed)

export default router