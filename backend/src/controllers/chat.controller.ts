// src/controllers/chat.controller.ts
import { Request, Response } from 'express'
import { PrismaClient }      from '@prisma/client'
import { AppError }          from '../middlewares/error.middleware'
import { createNotification } from './notification.controller'

const prisma = new PrismaClient()

export async function sendMessage(req: Request, res: Response) {
  const { receiverId, content } = req.body

  if (!content?.trim()) throw new AppError('Mensagem vazia')

  const message = await prisma.message.create({
    data: {
      content,
      senderId:   req.userId,
      receiverId,
    },
    include: {
      sender: {
        select: { id: true, name: true, username: true, avatarUrl: true }
      }
    }
  })

  await createNotification(
    receiverId,
    req.userId,
    'PRIVATE_MESSAGE',
    `${message.sender.name} te enviou uma mensagem`,
    `/messages`
  )

  return res.status(201).json(message)
}

export async function getConversation(req: Request, res: Response) {
  const { otherId } = req.params

  const messages = await prisma.message.findMany({
    where: {
      OR: [
        { senderId: req.userId, receiverId: String(otherId) },
        { senderId: String(otherId), receiverId: req.userId },
      ]
    },
    orderBy: { createdAt: 'asc' },
  })

  return res.json(messages)
}

export async function listConversations(req: Request, res: Response) {
  // Buscar usuários com quem o atual trocou mensagens
  const sent = await prisma.message.findMany({
    where: { senderId: req.userId },
    select: { receiver: { select: { id: true, name: true, username: true, avatarUrl: true } } },
    distinct: ['receiverId'],
  })

  const received = await prisma.message.findMany({
    where: { receiverId: req.userId },
    select: { sender: { select: { id: true, name: true, username: true, avatarUrl: true } } },
    distinct: ['senderId'],
  })

  const contacts = [...sent.map(m => m.receiver), ...received.map(m => m.sender)]
  const uniqueContacts = Array.from(new Map(contacts.map(c => [c.id, c])).values())

  // Adicionar contagem de não lidas para cada contato
  const conversations = await Promise.all(uniqueContacts.map(async (contact) => {
    const unreadCount = await prisma.message.count({
      where: {
        senderId: contact.id,
        receiverId: req.userId,
        read: false
      }
    })
    return { ...contact, unreadCount }
  }))

  return res.json(conversations)
}

export async function markAsRead(req: Request, res: Response) {
  const { otherId } = req.params
  
  await prisma.message.updateMany({
    where: {
      senderId: String(otherId),
      receiverId: req.userId,
      read: false
    },
    data: { read: true }
  })

  return res.json({ success: true })
}
