// src/routes/user.routes.ts
import { Router }          from 'express'
import {
  getProfile, getUserPosts,
  toggleFollow, searchUsers, getSuggestions,
  getRanking,
} from '../controllers/user.controller'
import { authMiddleware }   from '../middlewares/auth.middleware'

const router = Router()

router.get('/search',              authMiddleware, searchUsers)
router.get('/ranking',             authMiddleware, getRanking)
router.get('/suggestions',         authMiddleware, getSuggestions)
router.get('/:username',           authMiddleware, getProfile)
router.get('/:username/posts',     authMiddleware, getUserPosts)
router.post('/:id/follow',         authMiddleware, toggleFollow)

export default router