// src/controllers/team.controller.ts
import { Request, Response } from 'express'
import { PrismaClient }      from '@prisma/client'
import { z }                 from 'zod'
import { AppError }          from '../middlewares/error.middleware'
import { createNotification } from './notification.controller'

const prisma = new PrismaClient()

const teamSchema = z.object({
  name:        z.string().min(2),
  description: z.string().optional(),
  sport:       z.string(),
  logoUrl:     z.string().optional(),
})

export async function createTeam(req: Request, res: Response) {
  const { name, description, sport, logoUrl } = teamSchema.parse(req.body)

  const team = await prisma.team.create({
    data: {
      name,
      description,
      sport,
      logoUrl,
      captainId: req.userId,
      members: {
        create: {
          userId: req.userId,
          role:   'CAPTAIN',
          status: 'ACCEPTED',
        },
      },
    },
    include: {
      members: {
        include: {
          user: {
            select: { id: true, name: true, username: true, avatarUrl: true }
          }
        }
      }
    }
  })

  return res.status(201).json(team)
}

export async function getTeam(req: Request, res: Response) {
  const { id } = req.params

  const team = await prisma.team.findUnique({
    where: { id: String(id) },
    include: {
      captain: {
        select: { id: true, name: true, username: true, avatarUrl: true }
      },
      members: {
        include: {
          user: {
            select: { id: true, name: true, username: true, avatarUrl: true }
          }
        }
      },
      registrations: {
        include: {
          championship: true
        }
      }
    }
  })

  if (!team) throw new AppError('Time não encontrado', 404)

  return res.json(team)
}

export async function listTeams(req: Request, res: Response) {
  const { sport } = req.query
  const where = sport ? { sport: String(sport) } : {}

  const teams = await prisma.team.findMany({
    where,
    include: {
      _count: {
        select: { members: true }
      }
    }
  })

  return res.json(teams)
}

export async function inviteMember(req: Request, res: Response) {
  const { id }     = req.params
  const { userId } = req.body

  const team = await prisma.team.findUnique({ where: { id: String(id) } })
  if (!team) throw new AppError('Time não encontrado', 404)
  if (team.captainId !== req.userId) throw new AppError('Apenas o capitão pode convidar membros', 403)

  const member = await prisma.teamMember.create({
    data: {
      teamId: String(id),
      userId,
      status: 'PENDING',
    }
  })

  await createNotification(
    userId,
    req.userId,
    'TEAM_INVITE',
    `Você foi convidado para o time ${team.name}`,
    `/teams/${team.id}`,
    { teamId: team.id }
  )

  return res.status(201).json(member)
}

export async function removeMember(req: Request, res: Response) {
  const { id, userId } = req.params

  const team = await prisma.team.findUnique({
    where: { id: String(id) }
  })

  if (!team || team.captainId !== req.userId) {
    throw new AppError('Não autorizado', 403)
  }

  await prisma.teamMember.delete({
    where: {
      teamId_userId: {
        teamId: String(id),
        userId: String(userId)
      }
    }
  })

  return res.json({ success: true })
}

export async function respondToInvite(req: Request, res: Response) {
  const { id } = req.params // teamMemberId or teamId? Let's use teamId
  const { accept } = req.body

  const member = await prisma.teamMember.findUnique({
    where: {
      teamId_userId: {
        teamId: String(id),
        userId: req.userId
      }
    }
  })

  if (!member) throw new AppError('Convite não encontrado', 404)

  const updated = await prisma.teamMember.update({
    where: { id: member.id },
    data: {
      status: accept ? 'ACCEPTED' : 'REJECTED'
    }
  })

  return res.json(updated)
}
