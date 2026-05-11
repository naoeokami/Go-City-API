// src/routes/notification.routes.ts
import { Router } from 'express'
import { getNotifications, markAsRead, markAllAsRead } from '../controllers/notification.controller'
import { authMiddleware } from '../middlewares/auth.middleware'

const router = Router()

router.use(authMiddleware)

router.get('/',      getNotifications)
router.patch('/:id/read', markAsRead)
router.patch('/read-all', markAllAsRead)

export default router
