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

export async function addPointsToUser(userId: string, points: number, sport: string, isOfficial: boolean, matchId?: string) {
  try {
    // 1. Update the global score for quick display
    await prisma.user.update({
      where: { id: userId },
      data: {
        score: {
          increment: points
        }
      }
    })

    // 2. Create a granular record for filtered rankings
    await prisma.scoreEntry.create({
      data: {
        userId,
        points,
        sport,
        isOfficial,
        matchId
      }
    })
  } catch (error) {
    console.error(`Error adding points to user ${userId}:`, error)
  }
}

export async function addPointsToTeamMembers(teamId: string, points: number, sport: string, isOfficial: boolean, matchId?: string) {
  try {
    const members = await prisma.teamMember.findMany({
      where: { teamId, status: 'ACCEPTED' },
      select: { userId: true }
    })

    for (const member of members) {
      await addPointsToUser(member.userId, points, sport, isOfficial, matchId)
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
      championship: true,
    }
  })

  if (!match) return

  const sport = match.championship?.sport || match.sport || 'Geral'
  const isOfficial = match.isOfficial || !!match.championshipId

  // Unofficial match penalty (50%)
  const multiplier = isOfficial ? 1 : 0.5

  const awardPoints = async (side: 1 | 2, basePoints: number) => {
    const finalPoints = Math.round(basePoints * multiplier)
    const teamId = side === 1 ? match.team1Id : match.team2Id
    const soloPlayerId = side === 1 ? match.player1Id : match.player2Id
    const participants = match.participants.filter(p => p.side === side)

    if (teamId) {
      await addPointsToTeamMembers(teamId, finalPoints, sport, isOfficial, matchId)
    } else if (soloPlayerId) {
      await addPointsToUser(soloPlayerId, finalPoints, sport, isOfficial, matchId)
    } else if (participants.length > 0) {
      for (const p of participants) {
        await addPointsToUser(p.userId, finalPoints, sport, isOfficial, matchId)
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

export async function rewardTournamentPositions(championshipId: string, data: {
  championId?: string;
  runnerUpId?: string;
  thirdPlaceId?: string;
  fourthPlaceId?: string;
}) {
  const champ = await prisma.championship.findUnique({ where: { id: championshipId } })
  if (!champ) return

  const sport = champ.sport
  const isOfficial = true

  if (data.championId) await addPointsToTeamMembers(data.championId, POINTS.CHAMPION, sport, isOfficial)
  if (data.runnerUpId) await addPointsToTeamMembers(data.runnerUpId, POINTS.RUNNER_UP, sport, isOfficial)
  if (data.thirdPlaceId) await addPointsToTeamMembers(data.thirdPlaceId, POINTS.THIRD_PLACE, sport, isOfficial)
  if (data.fourthPlaceId) await addPointsToTeamMembers(data.fourthPlaceId, POINTS.FOURTH_PLACE, sport, isOfficial)
}

export async function rewardGroupStage(championshipId: string, data: {
  advancingTeamIds: string[];
  groupLeaderIds: string[];
}) {
  const champ = await prisma.championship.findUnique({ where: { id: championshipId } })
  if (!champ) return

  const sport = champ.sport
  const isOfficial = true

  for (const id of data.advancingTeamIds) {
    await addPointsToTeamMembers(id, POINTS.GROUP_ADVANCE, sport, isOfficial)
  }
  for (const id of data.groupLeaderIds) {
    await addPointsToTeamMembers(id, POINTS.GROUP_LEADER, sport, isOfficial)
  }
}
