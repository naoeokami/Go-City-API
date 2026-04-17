// src/controllers/registration.controller.ts
import { Request, Response } from 'express'
import { PrismaClient }      from '@prisma/client'
import { AppError }          from '../middlewares/error.middleware'

const prisma = new PrismaClient()

export async function createRegistration(req: Request, res: Response) {
  const { championshipId, teamId, teamName, participants } = req.body

  if (!championshipId) throw new AppError('Campeonato obrigatório')

  const championship = await prisma.championship.findUnique({
    where: { id: String(championshipId) },
  })

  if (!championship) throw new AppError('Campeonato não encontrado', 404)

  if (championship.status !== 'OPEN') {
    throw new AppError('Inscrições encerradas para este campeonato')
  }

  // Verificar se o tipo de inscrição bate com o campeonato
  if (teamId && championship.registrationType !== 'TEAM') {
    throw new AppError('Este campeonato aceita apenas inscrições individuais')
  }
  if (!teamId && championship.registrationType === 'TEAM') {
    throw new AppError('Este campeonato aceita apenas inscrições de equipes')
  }

  // Se estiver se inscrevendo como indivíduo (sem time)
  if (!teamId) {
    const existing = await prisma.registration.findFirst({
      where: {
        userId:        req.userId,
        championshipId: String(championshipId),
      },
    })
    if (existing) throw new AppError('Você já está inscrito neste campeonato')
  } else {
    // Se estiver inscrevendo um TIME
    const team = await prisma.team.findUnique({
      where: { id: String(teamId) }
    })

    if (!team) throw new AppError('Time não encontrado', 404)
    if (team.captainId !== req.userId) {
      throw new AppError('Somente o capitão da equipe pode realizar a inscrição')
    }

    const existingTeam = await prisma.registration.findFirst({
      where: {
        teamId: String(teamId),
        championshipId: String(championshipId),
      }
    })
    if (existingTeam) throw new AppError('Este time já está inscrito neste campeonato')
  }


  if (championship.maxParticipants) {
    const count = await prisma.registration.count({
      where: { championshipId: String(championshipId) },
    })

    if (count >= championship.maxParticipants) {
      throw new AppError('Campeonato com vagas esgotadas')
    }
  }

  const registration = await prisma.registration.create({
    data: {
      userId:        req.userId,
      championshipId: String(championshipId),
      teamId:        teamId ? String(teamId) : null,
      teamName,
      participants:  participants || [],
    },
    include: {
      championship: {
        select: { id: true, title: true, sport: true },
      },
    },
  })

  return res.status(201).json(registration)
}

export async function getMyRegistrations(req: Request, res: Response) {
  const registrations = await prisma.registration.findMany({
    where:   { userId: req.userId },
    include: { championship: true },
    orderBy: { createdAt: 'desc' },
  })

  return res.json(registrations)
}

export async function getChampionshipRegistrations(req: Request, res: Response) {
  const { championshipId } = req.params as { championshipId: string }

  const championship = await prisma.championship.findUnique({
    where: { id: championshipId },
  })

  if (!championship) throw new AppError('Campeonato não encontrado', 404)

  if (championship.organizerId !== req.userId) {
    throw new AppError('Sem permissão', 403)
  }

  const registrations = await prisma.registration.findMany({
    where:   { championshipId },
    include: {
      user: {
        select: {
          id: true, name: true,
          username: true, avatarUrl: true,
        },
      },
    },
  })

  return res.json(registrations)
}