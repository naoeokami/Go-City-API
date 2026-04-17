// src/utils/scoring.ts
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export const POINTS = {
  VICTORY: 50,
  DRAW: 20,
  LOSS: 5,
  WALKOVER: -30,
  GROUP_ADVANCE: 100,
  GROUP_LEADER: 50,
  PLAYOFF_VICTORY: 150, // Oitavas/Quartas
  SEMIFINAL_VICTORY: 300,
  FOURTH_PLACE: 100,
  THIRD_PLACE: 200,
  RUNNER_UP: 500,
  CHAMPION: 1000,
}

export async function addPointsToUser(userId: string, points: number) {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        score: {
          increment: points
        }
      }
    })
  } catch (error) {
    console.error(`Error adding points to user ${userId}:`, error)
  }
}

export async function addPointsToTeamMembers(teamId: string, points: number) {
  try {
    const members = await prisma.teamMember.findMany({
      where: { teamId, status: 'ACCEPTED' },
      select: { userId: true }
    })

    for (const member of members) {
      await addPointsToUser(member.userId, points)
    }
  } catch (error) {
    console.error(`Error adding points to team ${teamId}:`, error)
  }
}

export async function processMatchScore(matchId: string) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      team1: true,
      team2: true,
      player1: true,
      player2: true,
      participants: true,
    }
  })

  if (!match) return

  // Unofficial match penalty (50%)
  const multiplier = match.isOfficial ? 1 : 0.5

  const awardPoints = async (side: 1 | 2, basePoints: number) => {
    const finalPoints = Math.round(basePoints * multiplier)
    const teamId = side === 1 ? match.team1Id : match.team2Id
    const soloPlayerId = side === 1 ? match.player1Id : match.player2Id
    const participants = match.participants.filter(p => p.side === side)

    if (teamId) {
      await addPointsToTeamMembers(teamId, finalPoints)
    } else if (soloPlayerId) {
      await addPointsToUser(soloPlayerId, finalPoints)
    } else if (participants.length > 0) {
      // Award points to all mix participants on this side
      for (const p of participants) {
        await addPointsToUser(p.userId, finalPoints)
      }
    }
  }

  // Walkover logic
  if (match.isWalkover) {
    const winnerSide = match.winnerId === (match.team1Id || match.player1Id || match.participants.find(p => p.side === 1)?.userId) ? 1 : 2
    if (winnerSide === 1) {
      await awardPoints(1, POINTS.VICTORY)
      await awardPoints(2, POINTS.WALKOVER)
    } else {
      await awardPoints(2, POINTS.VICTORY)
      await awardPoints(1, POINTS.WALKOVER)
    }
    await highlightMatch(matchId)
    return
  }

  // Regular points calculation
  let points1 = 0
  let points2 = 0

  if (match.score1 > match.score2) {
    points1 = POINTS.VICTORY
    points2 = POINTS.LOSS
  } else if (match.score2 > match.score1) {
    points1 = POINTS.LOSS
    points2 = POINTS.VICTORY
  } else {
    points1 = POINTS.DRAW
    points2 = POINTS.DRAW
  }

  // Phase specific points
  if (match.phase) {
    const phaseLower = match.phase.toLowerCase()
    if (phaseLower.includes('oitava') || phaseLower.includes('quarta')) {
      if (match.score1 > match.score2) points1 += POINTS.PLAYOFF_VICTORY
      if (match.score2 > match.score1) points2 += POINTS.PLAYOFF_VICTORY
    } else if (phaseLower.includes('semi')) {
      if (match.score1 > match.score2) points1 += POINTS.SEMIFINAL_VICTORY
      if (match.score2 > match.score1) points2 += POINTS.SEMIFINAL_VICTORY
    }
  }

  await awardPoints(1, points1)
  await awardPoints(2, points2)
  
  await highlightMatch(matchId)
}

async function highlightMatch(matchId: string) {
  await prisma.match.update({
    where: { id: matchId },
    data: { isHighlighted: true }
  })

  // Create feed activity
  await prisma.activity.create({
    data: {
      type: 'MATCH_FINISHED',
      matchId: matchId,
    }
  })
}

export async function rewardTournamentPositions(data: {
  championId?: string;
  runnerUpId?: string;
  thirdPlaceId?: string;
  fourthPlaceId?: string;
}) {
  if (data.championId) await addPointsToTeamMembers(data.championId, POINTS.CHAMPION)
  if (data.runnerUpId) await addPointsToTeamMembers(data.runnerUpId, POINTS.RUNNER_UP)
  if (data.thirdPlaceId) await addPointsToTeamMembers(data.thirdPlaceId, POINTS.THIRD_PLACE)
  if (data.fourthPlaceId) await addPointsToTeamMembers(data.fourthPlaceId, POINTS.FOURTH_PLACE)
}

export async function rewardGroupStage(data: {
  advancingTeamIds: string[];
  groupLeaderIds: string[];
}) {
  for (const id of data.advancingTeamIds) {
    await addPointsToTeamMembers(id, POINTS.GROUP_ADVANCE)
  }
  for (const id of data.groupLeaderIds) {
    await addPointsToTeamMembers(id, POINTS.GROUP_LEADER)
  }
}
