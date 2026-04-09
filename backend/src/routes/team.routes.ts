// src/routes/team.routes.ts
import { Router } from 'express'
import { createTeam, getTeam, listTeams, inviteMember, respondToInvite, removeMember } from '../controllers/team.controller'
import { authMiddleware } from '../middlewares/auth.middleware'

const router = Router()

router.get('/',               listTeams)
router.get('/:id',            getTeam)
router.post('/',              authMiddleware, createTeam)
router.post('/:id/members',   authMiddleware, inviteMember)
router.post('/:id/respond',   authMiddleware, respondToInvite)
router.delete('/:id/members/:userId', authMiddleware, removeMember)

export default router
