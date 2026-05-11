// src/socket.ts
import { Server } from 'socket.io'
import http from 'http'

let io: Server

export const initSocket = (server: http.Server, frontendUrl: string) => {
  io = new Server(server, {
    cors: {
      origin: [
        frontendUrl,
        'http://localhost:5173',
        'http://localhost:5174',
        'https://go-city.vercel.app'
      ],
      methods: ["GET", "POST"],
      credentials: true,
    }
  })

  io.on('connection', (socket) => {
    console.log('User connected to socket:', socket.id)

    socket.on('join-championship', (championshipId) => {
      socket.join(`championship_${championshipId}`)
      console.log(`Socket ${socket.id} joined championship_${championshipId}`)
    })

    socket.on('disconnect', () => {
      console.log('User disconnected from socket:', socket.id)
    })
  })

  return io
}

export const getIo = () => {
  if (!io) {
    throw new Error('Socket.io not initialized')
  }
  return io
}
