// src/routes/story.routes.ts
import { Router } from 'express'
import { createStory, getStories, deleteStory } from '../controllers/story.controller'
import { authMiddleware } from '../middlewares/auth.middleware'

const router = Router()

router.get('/',      getStories) // Aberto para ver stories
router.post('/',     authMiddleware, createStory)
router.delete('/:id', authMiddleware, deleteStory)

export default router
