// src/controllers/story.controller.ts
import { Request, Response } from 'express'
import { PrismaClient }      from '@prisma/client'
import { AppError }          from '../middlewares/error.middleware'

const prisma = new PrismaClient()

export async function createStory(req: Request, res: Response) {
  const { imageUrl, type } = req.body

  if (!imageUrl) throw new AppError('Imagem é obrigatória', 400)

  const expiresAt = new Date()
  expiresAt.setHours(expiresAt.getHours() + 24)

  const story = await prisma.story.create({
    data: {
      imageUrl,
      type:      type || 'PHOTO',
      userId:    req.userId,
      expiresAt,
    },
    include: {
      user: {
        select: {
          id: true, name: true, username: true, avatarUrl: true,
        },
      },
    },
  })

  return res.status(201).json(story)
}

export async function getStories(req: Request, res: Response) {
  const now = new Date()

  // Buscar stories dos usuários que o atual segue
  const following = await prisma.follow.findMany({
    where: { followerId: req.userId },
    select: { followingId: true },
  })

  const userIds = following.map(f => f.followingId)
  userIds.push(req.userId)

  const stories = await prisma.story.findMany({
    where: {
      userId:    { in: userIds },
      expiresAt: { gt: now },
    },
    orderBy: { createdAt: 'desc' },
    include: {
      user: {
        select: {
          id: true, name: true, username: true, avatarUrl: true,
        },
      },
    },
  })

  // Agrupar stories por usuário
  const groupedStories = stories.reduce((acc: any, story) => {
    const userId = story.userId
    if (!acc[userId]) {
      acc[userId] = {
        user: story.user,
        stories: [],
      }
    }
    acc[userId].stories.push(story)
    return acc
  }, {})

  return res.json(Object.values(groupedStories))
}

export async function deleteStory(req: Request, res: Response) {
  const { id } = req.params

  const story = await prisma.story.findUnique({ where: { id: String(id) } })

  if (!story) throw new AppError('Story não encontrado', 404)
  if (story.userId !== req.userId) throw new AppError('Não autorizado', 403)

  await prisma.story.delete({ where: { id: String(id) } })

  return res.json({ success: true })
}
