// src/controllers/match.controller.ts
import { Request, Response } from 'express'
import { PrismaClient }      from '@prisma/client'
import { z }                 from 'zod'
import { AppError }          from '../middlewares/error.middleware'

const prisma = new PrismaClient()

const matchSchema = z.object({
  championshipId: z.string().optional().nullable(),
  team1Id:        z.string().optional().nullable(),
  team2Id:        z.string().optional().nullable(),
  date:           z.string(),
  location:       z.string().optional(),
  phase:          z.string().optional(),
})

export async function createMatch(req: Request, res: Response) {
  const data = matchSchema.parse(req.body)

  if (data.championshipId) {
    const championship = await prisma.championship.findUnique({
      where: { id: data.championshipId }
    })

    if (!championship) throw new AppError('Campeonato não encontrado', 404)
    if (championship.organizerId !== req.userId && req.userId) {
       // if it's a championship match, only the organizer can create it? 
       // User said "you can create your own match", maybe if championshipId is missing it's standalone.
    }
  }

  const match = await prisma.match.create({
    data: {
      ...data,
      date: new Date(data.date),
    },
    include: {
      team1: true,
      team2: true,
    }
  })

  return res.status(201).json(match)
}

export async function updateScore(req: Request, res: Response) {
  const { id }     = req.params
  const { score1, score2, status, isWalkover, winnerId } = req.body

  const match = await prisma.match.findUnique({
    where: { id: String(id) },
    include: { championship: true }
  })

  if (!match) throw new AppError('Partida não encontrada', 404)
  
  // If it's a championship match, check permissions
  if (match.championship && match.championship.organizerId !== req.userId) {
    throw new AppError('Sem permissão', 403)
  }

  const statusChangedToFinished = status === 'FINISHED' && match.status !== 'FINISHED'

  const updated = await prisma.match.update({
    where: { id: String(id) },
    data: {
      score1: score1 !== undefined ? Number(score1) : match.score1,
      score2: score2 !== undefined ? Number(score2) : match.score2,
      status: status || match.status,
      isWalkover: isWalkover !== undefined ? Boolean(isWalkover) : match.isWalkover,
      winnerId: winnerId || match.winnerId
    }
  })

  if (statusChangedToFinished) {
    const { processMatchScore } = await import('../utils/scoring')
    await processMatchScore(updated.id)
  }

  return res.json(updated)
}


export async function listChampionshipMatches(req: Request, res: Response) {
  const { championshipId } = req.params

  const matches = await prisma.match.findMany({
    where:   { championshipId: String(championshipId) },
    orderBy: { date: 'asc' },
    include: {
      team1: true,
      team2: true,
    }
  })

  return res.json(matches)
}
