// src/controllers/championship.controller.ts
import { Request, Response } from 'express'
import { PrismaClient, ChampionshipFormat, RegistrationType } from '@prisma/client'
import { z }                 from 'zod'
import { AppError }          from '../middlewares/error.middleware'

const prisma = new PrismaClient()

const championshipSchema = z.object({
  title:                z.string().min(3),
  description:          z.string().optional(),
  sport:                z.string(),
  format:               z.enum(['KNOCKOUT', 'ROUND_ROBIN', 'GROUPS_PLUS_KNOCKOUT']),
  registrationType:     z.enum(['INDIVIDUAL', 'TEAM']),
  maxParticipants:      z.number().optional().default(16),
  groupsCount:          z.number().optional().default(0),
  advancePerGroup:      z.number().optional().default(2),
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
  const validatedData = championshipSchema.parse(req.body)

  const championship = await prisma.championship.create({
    data: {
      title:                validatedData.title,
      description:          validatedData.description,
      sport:                validatedData.sport,
      format:               validatedData.format as ChampionshipFormat,
      registrationType:     validatedData.registrationType as RegistrationType,
      maxParticipants:      validatedData.maxParticipants,
      groupsCount:          validatedData.groupsCount,
      advancePerGroup:      validatedData.advancePerGroup,
      registrationFee:      validatedData.registrationFee,
      location:             validatedData.location,
      city:                 validatedData.city,
      state:                validatedData.state,
      rules:                validatedData.rules,
      prizes:               validatedData.prizes,
      startDate:            new Date(validatedData.startDate),
      endDate:              new Date(validatedData.endDate),
      registrationDeadline: new Date(validatedData.registrationDeadline),
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

export async function generateTournament(req: Request, res: Response) {
  const { id } = req.params as { id: string }
  
  const championship = await prisma.championship.findUnique({
    where: { id },
    include: { registrations: true }
  })

  if (!championship) throw new AppError('Campeonato não encontrado', 404)
  if (championship.organizerId !== req.userId) throw new AppError('Sem permissão', 403)

  const registrations = championship.registrations.filter(r => r.status === 'APPROVED')
  
  if (registrations.length < 2) {
    throw new AppError('É necessário pelo menos 2 inscrições aprovadas')
  }

  const { generateKnockoutMatches, generateGroupMatches } = await import('../utils/tournament')
  
  let matchesData = []

  if (championship.format === 'KNOCKOUT') {
    matchesData = await generateKnockoutMatches(id, registrations)
  } else if (championship.format === 'GROUPS_PLUS_KNOCKOUT') {
    if (!championship.groupsCount || championship.groupsCount <= 0) {
      throw new AppError('Quantidade de grupos não configurada')
    }
    matchesData = await generateGroupMatches(id, registrations, championship.groupsCount)
  } else if (championship.format === 'ROUND_ROBIN') {
    matchesData = await generateGroupMatches(id, registrations, 1) // 1 single group
  }

  // Clear existing matches if it's a re-draw? (Optional, let's keep it safe)
  // await prisma.match.deleteMany({ where: { championshipId: id } })

  const createdMatches = await prisma.match.createMany({
    data: matchesData
  })

  await prisma.championship.update({
    where: { id },
    data: { status: 'ONGOING' }
  })

  return res.json({ message: 'Torneio gerado com sucesso', count: createdMatches.count })
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

export async function finishChampionship(req: Request, res: Response) {
  const { id } = req.params as { id: string }
  const { championId, runnerUpId, thirdPlaceId, fourthPlaceId } = req.body

  const championship = await prisma.championship.findUnique({ where: { id } })

  if (!championship) throw new AppError('Campeonato não encontrado', 404)
  if (championship.organizerId !== req.userId) throw new AppError('Sem permissão', 403)

  const updated = await prisma.championship.update({
    where: { id },
    data: { status: 'FINISHED' }
  })

  // Apply points
  const { rewardTournamentPositions } = await import('../utils/scoring')
  await rewardTournamentPositions({
    championId,
    runnerUpId,
    thirdPlaceId,
    fourthPlaceId
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