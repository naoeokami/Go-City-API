// src/controllers/auth.controller.ts
import { Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import { AppError } from '../middlewares/error.middleware'

const prisma = new PrismaClient()

const registerSchema = z.object({
    name: z.string().min(2, 'Nome muito curto'),
    username: z.string().min(3, 'Username muito curto')
        .regex(/^[a-zA-Z0-9_]+$/, 'Username inválido'),
    email: z.string().email('Email inválido'),
    password: z.string().min(6, 'Senha muito curta'),
    userType: z.enum(['FAN', 'ATHLETE', 'COACH', 'REFEREE', 'ORGANIZER', 'JOURNALIST']),
    sport: z.array(z.string()).optional(),
    city: z.string().optional(),
    state: z.string().optional(),
})

const loginSchema = z.object({
    email: z.string().email(),
    password: z.string(),
})

export async function register(req: Request, res: Response) {
    const data = registerSchema.parse(req.body)

    const existingUser = await prisma.user.findFirst({
        where: {
            OR: [
                { email: data.email },
                { username: data.username },
            ],
        },
    })

    if (existingUser) {
        if (existingUser.email === data.email) {
            throw new AppError('Email já cadastrado')
        }
        throw new AppError('Username já existe')
    }

    const hashedPassword = await bcrypt.hash(data.password, 10)

    const user = await prisma.user.create({
        data: {
            ...data,
            password: hashedPassword,
            sport: data.sport || [],
        },
        select: {
            id: true, name: true, username: true,
            email: true, userType: true, avatarUrl: true,
        },
    })

    const token = jwt.sign(
        { sub: user.id },
        process.env.JWT_SECRET as string,
        { expiresIn: '7d' }
    )

    return res.status(201).json({ user, token })
}

export async function login(req: Request, res: Response) {
    const { email, password } = loginSchema.parse(req.body)

    const user = await prisma.user.findUnique({ where: { email } })

    if (!user) {
        throw new AppError('Credenciais inválidas', 401)
    }

    const passwordMatch = await bcrypt.compare(password, user.password)

    if (!passwordMatch) {
        throw new AppError('Credenciais inválidas', 401)
    }

    const token = jwt.sign(
        { sub: user.id },
        process.env.JWT_SECRET as string,
        { expiresIn: '7d' }
    )

    const { password: _, ...userWithoutPassword } = user

    return res.json({ user: userWithoutPassword, token })
}

export async function me(req: Request, res: Response) {
    const user = await prisma.user.findUnique({
        where: { id: req.userId },
        select: {
            id: true, name: true, username: true,
            email: true, bio: true, avatarUrl: true,
            coverUrl: true, userType: true, sport: true,
            city: true, state: true, isVerified: true,
            createdAt: true,
            _count: {
                select: {
                    posts: true,
                    followers: true,
                    following: true,
                },
            },
        },
    })

    if (!user) throw new AppError('Usuário não encontrado', 404)

    return res.json(user)
}