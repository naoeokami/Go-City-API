// src/controllers/championship.controller.ts
import { Request, Response } from 'express'
import { PrismaClient }      from '@prisma/client'
import { z }                 from 'zod'
import { AppError }          from '../middlewares/error.middleware'

const prisma = new PrismaClient()

const championshipSchema = z.object({
  title:                z.string().min(3),
  description:          z.string().min(10),
  sport:                z.string(),
  format:               z.string(),
  maxParticipants:      z.number().optional(),
  registrationFee:      z.number().default(0),
  startDate:            z.string(),
  endDate:              z.string(),
  registrationDeadline: z.string(),
  location:             z.string(),
  city:                 z.string(),
  state:                z.string(),
  rules:                z.string().optional(),
  prizes:               z.string().optional(),
})

export async function createChampionship(req: Request, res: Response) {
  const data = championshipSchema.parse(req.body)

  const championship = await prisma.championship.create({
    data: {
      ...data,
      startDate:            new Date(data.startDate),
      endDate:              new Date(data.endDate),
      registrationDeadline: new Date(data.registrationDeadline),
      organizerId:          req.userId,
      status:               'DRAFT',
    },
    include: {
      organizer: {
        select: {
          id: true, name: true,
          username: true, avatarUrl: true,
        },
      },
    },
  })

  return res.status(201).json(championship)
}

export async function listChampionships(req: Request, res: Response) {
  const { sport, status, city, page = '1', limit = '10' } = req.query

  const skip  = (Number(page) - 1) * Number(limit)
  const where: any = {}

  if (sport)  where.sport  = String(sport)
  if (status) where.status = String(status)
  if (city)   where.city   = { contains: String(city), mode: 'insensitive' }

  const [championships, total] = await Promise.all([
    prisma.championship.findMany({
      where,
      skip,
      take:    Number(limit),
      orderBy: { createdAt: 'desc' },
      include: {
        organizer: {
          select: {
            id: true, name: true,
            username: true, avatarUrl: true,
          },
        },
        _count: {
          select: { registrations: true },
        },
      },
    }),
    prisma.championship.count({ where }),
  ])

  return res.json({
    data: championships,
    pagination: {
      total,
      page:       Number(page),
      limit:      Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
    },
  })
}

export async function getChampionship(req: Request, res: Response) {
  const { id } = req.params as { id: string }

  const championship = await prisma.championship.findUnique({
    where: { id },
    include: {
      organizer: {
        select: {
          id: true, name: true,
          username: true, avatarUrl: true,
        },
      },
      results: {
        orderBy: { date: 'desc' },
      },
      matches: {
        include: {
          team1: true,
          team2: true,
        },
        orderBy: { date: 'asc' },
      },
      _count: {
        select: { registrations: true },
      },
    },
  })

  if (!championship) throw new AppError('Campeonato não encontrado', 404)

  return res.json(championship)
}

export async function updateChampionshipStatus(req: Request, res: Response) {
  const { id }     = req.params as { id: string }
  const { status } = req.body

  const championship = await prisma.championship.findUnique({ where: { id } })

  if (!championship) throw new AppError('Campeonato não encontrado', 404)

  if (championship.organizerId !== req.userId) {
    throw new AppError('Sem permissão para editar', 403)
  }

  const updated = await prisma.championship.update({
    where: { id },
    data:  { status },
  })

  return res.json(updated)
}

export async function addResult(req: Request, res: Response) {
  const { id } = req.params as { id: string }

  const championship = await prisma.championship.findUnique({ where: { id } })

  if (!championship) throw new AppError('Campeonato não encontrado', 404)

  if (championship.organizerId !== req.userId) {
    throw new AppError('Sem permissão', 403)
  }

  const result = await prisma.result.create({
    data: {
      championshipId: id,
      phase:          req.body.phase,
      team1:          req.body.team1,
      team2:          req.body.team2,
      score1:         req.body.score1,
      score2:         req.body.score2,
      date:           new Date(req.body.date),
      notes:          req.body.notes,
    },
  })

  return res.status(201).json(result)
}