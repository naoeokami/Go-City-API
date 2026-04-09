// src/controllers/post.controller.ts
import { Request, Response } from 'express'
import { PrismaClient }      from '@prisma/client'
import { AppError }          from '../middlewares/error.middleware'

const prisma = new PrismaClient()

export async function createPost(req: Request, res: Response) {
  const { content, imageUrl, sport } = req.body

  if (!content?.trim()) throw new AppError('Conteúdo obrigatório')

  const post = await prisma.post.create({
    data: {
      content,
      imageUrl,
      sport,
      authorId: req.userId,
    },
    include: {
      author: {
        select: {
          id: true, name: true, username: true,
          avatarUrl: true, userType: true, isVerified: true,
        },
      },
      _count: {
        select: { likes: true, comments: true },
      },
    },
  })

  return res.status(201).json(post)
}

export async function getFeed(req: Request, res: Response) {
  const { page = '1', limit = '10' } = req.query

  const following = await prisma.follow.findMany({
    where:  { followerId: req.userId },
    select: { followingId: true },
  })

  const followingIds = following.map(f => f.followingId)
  followingIds.push(req.userId)

  const skip = (Number(page) - 1) * Number(limit)

  const posts = await prisma.post.findMany({
    where:   { authorId: { in: followingIds } },
    skip,
    take:    Number(limit),
    orderBy: { createdAt: 'desc' },
    include: {
      author: {
        select: {
          id: true, name: true, username: true,
          avatarUrl: true, userType: true, isVerified: true,
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

export async function toggleLike(req: Request, res: Response) {
  const { id } = req.params as { id: string }

  const existingLike = await prisma.like.findUnique({
    where: {
      userId_postId: {
        userId: req.userId,
        postId: id,
      },
    },
  })

  if (existingLike) {
    await prisma.like.delete({ where: { id: existingLike.id } })
    return res.json({ liked: false })
  }

  await prisma.like.create({
    data: { userId: req.userId, postId: id },
  })

  return res.json({ liked: true })
}

export async function addComment(req: Request, res: Response) {
  const { id }      = req.params as { id: string }
  const { content } = req.body

  if (!content?.trim()) throw new AppError('Comentário vazio')

  const comment = await prisma.comment.create({
    data: {
      content,
      postId:   id,
      authorId: req.userId,
    },
    include: {
      author: {
        select: {
          id: true, name: true,
          username: true, avatarUrl: true,
        },
      },
    },
  })

  return res.status(201).json(comment)
}

export async function getComments(req: Request, res: Response) {
  const { id } = req.params as { id: string }

  const comments = await prisma.comment.findMany({
    where:   { postId: id },
    orderBy: { createdAt: 'asc' },
    include: {
      author: {
        select: {
          id: true, name: true,
          username: true, avatarUrl: true,
        },
      },
    },
  })

  return res.json(comments)
}

// Função para deletar postagens (que estava dando 404)
export async function deletePost(req: Request, res: Response) {
  const { id } = req.params

  const post = await prisma.post.findUnique({ where: { id: String(id) } })

  if (!post) throw new AppError('Postagem não encontrada', 404)
  if (post.authorId !== req.userId) throw new AppError('Não autorizado', 403)

  await prisma.post.delete({ where: { id: String(id) } })

  return res.json({ success: true })
}

// Função para o Explorar (mostrar posts recentes de todos)
export async function getExploreFeed(req: Request, res: Response) {
  const { page = '1', limit = '12' } = req.query
  const skip = (Number(page) - 1) * Number(limit)

  const posts = await prisma.post.findMany({
    skip,
    take:    Number(limit),
    orderBy: { createdAt: 'desc' },
    include: {
      author: {
        select: {
          id: true, name: true, username: true,
          avatarUrl: true, userType: true, isVerified: true,
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
