// src/middlewares/auth.middleware.ts
import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { AppError } from './error.middleware'

interface TokenPayload {
  sub: string
  iat: number
  exp: number
}

declare global {
  namespace Express {
    interface Request {
      userId: string
    }
  }
}

export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization

  if (!authHeader) {
    throw new AppError('Token não fornecido', 401)
  }

  const [, token] = authHeader.split(' ')

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET as string
    ) as TokenPayload

    req.userId = decoded.sub
    next()
  } catch {
    throw new AppError('Token inválido ou expirado', 401)
  }
}