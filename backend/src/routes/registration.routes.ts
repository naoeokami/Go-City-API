// src/routes/registration.routes.ts
import { Router } from 'express'
import {
  createRegistration,
  getMyRegistrations,
  getChampionshipRegistrations,
} from '../controllers/registration.controller'
import { authMiddleware } from '../middlewares/auth.middleware'

const router = Router()

router.post('/',                          authMiddleware, createRegistration)
router.get('/my',                         authMiddleware, getMyRegistrations)
router.get('/:championshipId/list',       authMiddleware, getChampionshipRegistrations)

export default router