// src/server.ts
import express            from 'express'
import cors               from 'cors'
import dotenv             from 'dotenv'

import authRoutes         from './routes/auth.routes'
import userRoutes         from './routes/user.routes'
import postRoutes         from './routes/post.routes'
import championshipRoutes from './routes/championship.routes'
import registrationRoutes from './routes/registration.routes'
import uploadRoutes       from './routes/upload.routes'
import storyRoutes        from './routes/story.routes'
import notificationRoutes from './routes/notification.routes'
import teamRoutes         from './routes/team.routes'
import matchRoutes        from './routes/match.routes'
import chatRoutes         from './routes/chat.routes'

import { errorMiddleware } from './middlewares/error.middleware'

dotenv.config()

const app  = express()
const PORT = process.env.PORT || 3333

app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:5173',
    'http://localhost:5173',
    'http://localhost:5174',
    'https://go-city.vercel.app'
  ],
  credentials: true,
}))

app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() })
})

app.use('/api/auth',          authRoutes)
app.use('/api/users',         userRoutes)
app.use('/api/posts',         postRoutes)
app.use('/api/championships', championshipRoutes)
app.use('/api/registrations', registrationRoutes)
app.use('/api/upload',        uploadRoutes)
app.use('/api/stories',       storyRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api/teams',         teamRoutes)
app.use('/api/matches',       matchRoutes)
app.use('/api/chat',          chatRoutes)

app.use(errorMiddleware)

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`)
})

export default app