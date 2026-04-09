// src/routes/match.routes.ts
import { Router } from 'express'
import { createMatch, updateScore, listChampionshipMatches } from '../controllers/match.controller'
import { authMiddleware } from '../middlewares/auth.middleware'

const router = Router()

router.get('/championship/:championshipId', listChampionshipMatches)
router.post('/',              authMiddleware, createMatch)
router.patch('/:id/score',   authMiddleware, updateScore)

export default router
