// src/controllers/user.controller.ts
import { Request, Response } from 'express'

import { AppError }          from '../middlewares/error.middleware'

import { prisma } from '../lib/prisma'

export async function getProfile(req: Request, res: Response) {
  const { username } = req.params as { username: string }

  const user = await prisma.user.findUnique({
    where: { username },
    select: {
      id: true, name: true, username: true,
      bio: true, avatarUrl: true, coverUrl: true,
      userType: true, sport: true, city: true,
      state: true, isVerified: true, createdAt: true,
      score: true,
      _count: {
        select: {
          posts:     true,
          followers: true,
          following: true,
        },
      },
    },
  })

  if (!user) throw new AppError('Usuário não encontrado', 404)

  // Fetch actual matches played or fallback to gamification stats
  const matchesPlayed = await prisma.matchParticipant.count({ where: { userId: user.id } })

  // Build gamification payload
  const gamification = {
    matchesPlayed: matchesPlayed > 0 ? matchesPlayed : 45, // Fallback for mockup if 0
    winRate: matchesPlayed > 0 ? 55 : 68, // Mocked win rate
    badges: [
      { id: '1', title: 'Top 1 Ranking', icon: 'Trophy', color: 'yellow' },
      { id: '2', title: '10 Dias Seguidos', icon: 'Calendar', color: 'blue' },
      { id: '3', title: 'Influenciador', icon: 'UserPlus', color: 'green' }
    ],
    recentPerformance: ['win', 'loss', 'win', 'win', 'draw'] // Mock performance
  }

  return res.json({ ...user, gamification })
}

export async function getUserPosts(req: Request, res: Response) {
  const { username } = req.params as { username: string }

  const user = await prisma.user.findUnique({ where: { username } })

  if (!user) throw new AppError('Usuário não encontrado', 404)

  const posts = await prisma.post.findMany({
    where:   { authorId: user.id },
    orderBy: { createdAt: 'desc' },
    include: {
      author: {
        select: {
          id: true, name: true,
          username: true, avatarUrl: true,
          userType: true, isVerified: true,
        },
      },
      likes: {
        where:  { userId: req.userId },
        select: { id: true },
      },
      _count: {
        select: { likes: true, comments: true },
      },
    },
  })

  const postsWithLiked = posts.map(post => ({
    ...post,
    liked: post.likes.length > 0,
    likes: undefined,
  }))

  return res.json(postsWithLiked)
}

export async function toggleFollow(req: Request, res: Response) {
  const { id }       = req.params as { id: string }
  const followerId   = req.userId

  if (followerId === id) {
    throw new AppError('Você não pode seguir a si mesmo', 400)
  }

  const existing = await prisma.follow.findUnique({
    where: {
      followerId_followingId: {
        followerId,
        followingId: id,
      },
    },
  })

  if (existing) {
    await prisma.follow.delete({ where: { id: existing.id } })
    return res.json({ following: false })
  }

  await prisma.follow.create({
    data: { followerId, followingId: id },
  })

  return res.json({ following: true })
}

export async function searchUsers(req: Request, res: Response) {
  const { q } = req.query

  if (!q) return res.json([])

  const users = await prisma.user.findMany({
    where: {
      OR: [
        { name:     { contains: String(q), mode: 'insensitive' } },
        { username: { contains: String(q), mode: 'insensitive' } },
      ],
    },
    select: {
      id: true, name: true, username: true,
      avatarUrl: true, userType: true, isVerified: true,
    },
    take: 10,
  })

  return res.json(users)
}

export async function getRanking(req: Request, res: Response) {
  const { limit = '50', sport, category } = req.query as { limit?: string, sport?: string, category?: string }

  // If no filters, return global ranking (optimized)
  if (!sport && !category) {
    const users = await prisma.user.findMany({
      orderBy: { score: 'desc' },
      take: Number(limit),
      select: {
        id: true, name: true, username: true,
        avatarUrl: true, userType: true, isVerified: true,
        score: true, city: true, state: true
      }
    })
    return res.json(users)
  }

  // With filters, we aggregate from score_entries
  const where: any = {}
  if (sport) where.sport = sport
  if (category === 'COMPETITIVE') where.isOfficial = true
  if (category === 'CASUAL') where.isOfficial = false

  const aggregated = await prisma.scoreEntry.groupBy({
    by: ['userId'],
    where,
    _sum: { points: true },
    orderBy: { _sum: { points: 'desc' } },
    take: Number(limit),
  })

  // Fetch user details for the top ranked
  const userIds = aggregated.map(a => a.userId)
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: {
      id: true, name: true, username: true,
      avatarUrl: true, userType: true, isVerified: true,
      city: true, state: true
    }
  })

  // Map sums back to users and sort again
  const result = aggregated.map(a => {
    const user = users.find(u => u.id === a.userId)
    return {
      ...user,
      score: a._sum.points || 0
    }
  }).sort((a, b) => b.score - a.score)

  return res.json(result)
}

export async function getSuggestions(req: Request, res: Response) {
  const userId = req.userId

  const suggestions = await prisma.user.findMany({
    where: {
      id: { not: userId },
      followers: {
        none: { followerId: userId }
      }
    },
    select: {
      id: true, name: true, username: true,
      avatarUrl: true, userType: true, isVerified: true,
    },
    take: 5,
  })

  return res.json(suggestions)
}