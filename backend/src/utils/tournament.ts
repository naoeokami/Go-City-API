// src/utils/tournament.ts
import { PrismaClient, Team, User } from '@prisma/client'

const prisma = new PrismaClient()

interface Participant {
  id: string; // Registration ID
  teamId?: string | null;
  userId: string;
}

export async function generateKnockoutMatches(championshipId: string, participants: Participant[]) {
  // Shuffle participants
  const shuffled = [...participants].sort(() => Math.random() - 0.5)
  const matches = []

  // Generate matches for the first round
  for (let i = 0; i < shuffled.length; i += 2) {
    const p1 = shuffled[i]
    const p2 = shuffled[i + 1]

    matches.push({
      championshipId,
      team1Id: p1?.teamId || null,
      team2Id: p2?.teamId || null,
      // If individual, we might need a different way to link users to matches
      // but current Match model uses team1Id/team2Id. 
      // Need to ensure Match can also handle direct Users if it's an individual tournament.
      // For now, let's assume it's mostly Team based or that individual "teams" are created.
      phase: shuffled.length <= 2 ? 'Final' : 
             shuffled.length <= 4 ? 'Semifinal' : 
             shuffled.length <= 8 ? 'Quartas de Final' : 'Oitavas de Final',
      date: new Date(),
      status: 'SCHEDULED' as const
    })
  }

  return matches
}

export async function generateGroupMatches(championshipId: string, participants: Participant[], groupsCount: number) {
  const shuffled = [...participants].sort(() => Math.random() - 0.5)
  const groups: Participant[][] = Array.from({ length: groupsCount }, () => [])

  // Distribute participants into groups
  shuffled.forEach((p, i) => {
    groups[i % groupsCount].push(p)
  })

  const matches = []
  
  // For each group, generate round-robin matches
  groups.forEach((group, groupIdx) => {
    const groupName = `Grupo ${String.fromCharCode(65 + groupIdx)}`
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        matches.push({
          championshipId,
          team1Id: group[i].teamId || null,
          team2Id: group[j].teamId || null,
          phase: groupName,
          date: new Date(),
          status: 'SCHEDULED' as const
        })
      }
    }
  })

  return matches
}
