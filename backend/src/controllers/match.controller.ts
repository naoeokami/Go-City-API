// src/controllers/match.controller.ts
import { Request, Response } from 'express'

import { z }                 from 'zod'
import { AppError }          from '../middlewares/error.middleware'

import { prisma } from '../lib/prisma'

const matchSchema = z.object({
  championshipId: z.string().optional().nullable(),
  team1Id:        z.string().optional().nullable(),
  team2Id:        z.string().optional().nullable(),
  player1Id:      z.string().optional().nullable(),
  player2Id:      z.string().optional().nullable(),
  side1UserIds:   z.array(z.string()).optional(), // Array for mix teams
  side2UserIds:   z.array(z.string()).optional(),
  date:           z.string(),
  location:       z.string().optional(),
  phase:          z.string().optional(),
  isOfficial:     z.boolean().optional().default(true),
})

export async function createMatch(req: Request, res: Response) {
  const data = matchSchema.parse(req.body)

  if (data.championshipId) {
    const championship = await prisma.championship.findUnique({
      where: { id: data.championshipId }
    })
    if (!championship) throw new AppError('Campeonato não encontrado', 404)
  }

  const match = await prisma.match.create({
    data: {
      championshipId: data.championshipId || null,
      team1Id:        data.team1Id || null,
      team2Id:        data.team2Id || null,
      player1Id:      data.player1Id || null,
      player2Id:      data.player2Id || null,
      date:           new Date(data.date),
      location:       data.location || null,
      phase:          data.phase || null,
      isOfficial:     data.isOfficial ?? true,
      participants: {
        create: [
          ...(data.side1UserIds?.map(userId => ({ userId, side: 1 })) || []),
          ...(data.side2UserIds?.map(userId => ({ userId, side: 2 })) || []),
        ]
      }
    },
    include: {
      team1: true,
      team2: true,
      player1: true,
      player2: true,
      participants: {
        include: { user: true }
      }
    }
  })

  return res.status(201).json(match)
}

export async function updateScore(req: Request, res: Response) {
  const { id }     = req.params
  const { score1, score2, status, isWalkover, winnerId, isHighlighted } = req.body
  const userId = (req as any).userId

  const match = await prisma.match.findUnique({
    where: { id: String(id) },
    include: { championship: true }
  })

  if (!match) throw new AppError('Partida não encontrada', 404)
  
  if (match.championship && match.championship.organizerId !== userId) {
    throw new AppError('Sem permissão', 403)
  }

  try {
    const statusChangedToFinished = status === 'FINISHED' && match.status !== 'FINISHED'

    const updated = await prisma.match.update({
      where: { id: String(id) },
      data: {
        score1: score1 !== undefined ? Number(score1) : match.score1,
        score2: score2 !== undefined ? Number(score2) : match.score2,
        status: status || match.status,
        isWalkover: isWalkover !== undefined ? Boolean(isWalkover) : match.isWalkover,
        winnerId: winnerId || match.winnerId,
        isHighlighted: isHighlighted !== undefined ? Boolean(isHighlighted) : match.isHighlighted
      },
      include: {
        team1: true,
        team2: true,
        player1: {
          select: { id: true, name: true, avatarUrl: true, username: true }
        },
        player2: {
          select: { id: true, name: true, avatarUrl: true, username: true }
        }
      }
    })

    if (statusChangedToFinished) {
      const { processMatchScore } = await import('../utils/scoring')
      await processMatchScore(updated.id)

      // Only handle bracket progression if it's a knockout match with a next stage
      if (updated.nextMatchId && updated.bracketOrder !== null) {
        const nextMatch = await prisma.match.findUnique({
          where: { id: updated.nextMatchId }
        })

        if (nextMatch) {
          const winnerId = (updated.score1 ?? 0) > (updated.score2 ?? 0) ? (updated.team1Id || updated.player1Id) : (updated.team2Id || updated.player2Id)
          
          if (winnerId) {
            const side = updated.bracketOrder % 2 === 0 ? '1' : '2'
            await prisma.match.update({
              where: { id: nextMatch.id },
              data: {
                [`team${side}Id`]: updated.team1Id ? winnerId : null,
                [`player${side}Id`]: updated.player1Id ? winnerId : null,
              }
            })
          }
        }
      }
    }

    // Emit socket event if it belongs to a championship
    if (updated.championshipId) {
      try {
        const { getIo } = await import('../socket')
        const io = getIo()
        io.to(`championship_${updated.championshipId}`).emit('match-updated', updated)
      } catch (err) {
        console.error('Socket emission failed:', err)
      }
    }

    return res.json(updated)
  } catch (error) {
    console.error('Error updating match score:', error)
    return res.status(500).json({ error: 'Erro ao atualizar placar. Verifique se os dados estão corretos.' })
  }
}

export async function listChampionshipMatches(req: Request, res: Response) {
  const { championshipId } = req.params

  const matches = await prisma.match.findMany({
    where:   { championshipId: String(championshipId) },
    orderBy: { date: 'asc' },
    include: {
      team1: true,
      team2: true,
      player1: true,
      player2: true,
      participants: {
        include: { user: true }
      }
    }
  })

  return res.json(matches)
}

export async function listStandaloneMatches(req: Request, res: Response) {
  const matches = await prisma.match.findMany({
    where: { championshipId: null },
    orderBy: { createdAt: 'desc' },
    include: {
      team1: true,
      team2: true,
      player1: true,
      player2: true,
      participants: {
        include: { user: true }
      }
    }
  })
  return res.json(matches)
}
