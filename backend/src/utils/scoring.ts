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
    }
  })

  if (!match || !match.team1Id || !match.team2Id) return

  if (match.isWalkover) {
    // If it's a walkover, the winner gets victory points, the loser gets walkover points
    if (match.winnerId === match.team1Id) {
      await addPointsToTeamMembers(match.team1Id, POINTS.VICTORY)
      await addPointsToTeamMembers(match.team2Id, POINTS.WALKOVER)
    } else if (match.winnerId === match.team2Id) {
      await addPointsToTeamMembers(match.team2Id, POINTS.VICTORY)
      await addPointsToTeamMembers(match.team1Id, POINTS.WALKOVER)
    }
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

  await addPointsToTeamMembers(match.team1Id, points1)
  await addPointsToTeamMembers(match.team2Id, points2)
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

