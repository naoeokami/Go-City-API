// src/routes/championship.routes.ts
import { Router } from 'express'
import {
  createChampionship, listChampionships,
  getChampionship, updateChampionshipStatus, addResult,
} from '../controllers/championship.controller'
import { authMiddleware } from '../middlewares/auth.middleware'

const router = Router()

router.get('/',             listChampionships)
router.get('/:id',          getChampionship)
router.post('/',            authMiddleware, createChampionship)
router.patch('/:id/status', authMiddleware, updateChampionshipStatus)
router.post('/:id/results', authMiddleware, addResult)

export default router