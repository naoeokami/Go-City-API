// src/controllers/notification.controller.ts
import { Request, Response } from 'express'
import { PrismaClient, NotificationType }      from '@prisma/client'

const prisma = new PrismaClient()

export async function getNotifications(req: Request, res: Response) {
  const notifications = await prisma.notification.findMany({
    where:   { userId: req.userId },
    orderBy: { createdAt: 'desc' },
    include: {
      sender: {
        select: {
          id: true, name: true, username: true, avatarUrl: true,
        },
      },
    },
  })

  return res.json(notifications)
}

export async function markAsRead(req: Request, res: Response) {
  const { id } = req.params

  await prisma.notification.update({
    where: { id: String(id) },
    data:  { read: true },
  })

  return res.json({ success: true })
}

export async function markAllAsRead(req: Request, res: Response) {
  await prisma.notification.updateMany({
    where: { userId: req.userId, read: false },
    data:  { read: true },
  })

  return res.json({ success: true })
}

// Helper function to create notification
export async function createNotification(
  userId: string,
  senderId: string | null,
  type: NotificationType,
  message: string,
  link?: string,
  metadata?: any
) {
  try {
    // Evitar que o usuário receba notificação de si mesmo
    if (userId === senderId) return

    await prisma.notification.create({
      data: {
        userId: String(userId),
        senderId: senderId ? String(senderId) : null,
        type,
        message,
        link,
        metadata: metadata ? (typeof metadata === 'string' ? JSON.parse(metadata) : metadata) : null,
      },
    })
  } catch (error) {
    console.error('Error creating notification:', error)
  }
}
