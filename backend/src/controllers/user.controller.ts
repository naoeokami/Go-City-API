// src/controllers/user.controller.ts
import { Request, Response } from 'express'
import { PrismaClient }      from '@prisma/client'
import { AppError }          from '../middlewares/error.middleware'

const prisma = new PrismaClient()

export async function getProfile(req: Request, res: Response) {
  const { username } = req.params as { username: string }

  const user = await prisma.user.findUnique({
    where: { username },
    select: {
      id: true, name: true, username: true,
      bio: true, avatarUrl: true, coverUrl: true,
      userType: true, sport: true, city: true,
      state: true, isVerified: true, createdAt: true,
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

  return res.json(user)
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