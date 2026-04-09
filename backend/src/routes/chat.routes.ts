// src/routes/chat.routes.ts
import { Router } from 'express'
import { sendMessage, getConversation, listConversations, markAsRead } from '../controllers/chat.controller'
import { authMiddleware } from '../middlewares/auth.middleware'

const router = Router()

router.use(authMiddleware)

router.get('/conversations', listConversations)
router.get('/:otherId',      getConversation)
router.put('/:otherId/read', markAsRead)
router.post('/',             sendMessage)

export default router
