// src/middlewares/error.middleware.ts
import { Request, Response, NextFunction } from 'express'

export class AppError {
  public readonly message: string
  public readonly statusCode: number

  constructor(message: string, statusCode = 400) {
    this.message = message
    this.statusCode = statusCode
  }
}

export function errorMiddleware(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): Response {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.message,
    })
  }

  console.error('Erro não tratado:', err)

  return res.status(500).json({
    error: 'Erro interno do servidor',
    message: err.message
  })
}