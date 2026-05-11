// src/routes/championship.routes.ts
import { Router } from 'express'
import {
  createChampionship, listChampionships,
  getChampionship, updateChampionshipStatus, addResult,
  finishChampionship, generateTournament, requestRegistration
} from '../controllers/championship.controller'
import {
  generateGroups, generateBrackets, getStandings
} from '../controllers/tournament-manager.controller'
import { authMiddleware } from '../middlewares/auth.middleware'

const router = Router()

router.get('/',             listChampionships)
router.get('/:id',          getChampionship)
router.post('/',            authMiddleware, createChampionship)
router.patch('/:id/status', authMiddleware, updateChampionshipStatus)
router.post('/:id/generate', authMiddleware, generateTournament)
router.post('/:id/generate-groups', authMiddleware, generateGroups)
router.post('/:id/generate-brackets', authMiddleware, generateBrackets)
router.get('/:id/standings', getStandings)
router.post('/:id/results', authMiddleware, addResult)
router.post('/:id/finish',  authMiddleware, finishChampionship)
router.post('/:id/request-registration', authMiddleware, requestRegistration)

export default router