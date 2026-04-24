// src/routes/registration.routes.ts
import { Router } from 'express'
import {
  createRegistration,
  getMyRegistrations,
  getChampionshipRegistrations,
  updateRegistrationStatus,
  deleteRegistration,
} from '../controllers/registration.controller'
import { authMiddleware } from '../middlewares/auth.middleware'

const router = Router()

router.post('/',                          authMiddleware, createRegistration)
router.get('/my',                         authMiddleware, getMyRegistrations)
router.get('/:championshipId/list',       authMiddleware, getChampionshipRegistrations)
router.patch('/:id/status',               authMiddleware, updateRegistrationStatus)
router.delete('/:id',                     authMiddleware, deleteRegistration)

export default router