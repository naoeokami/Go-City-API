import { Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { AppError } from '../middlewares/error.middleware'

export async function generateGroups(req: Request, res: Response) {
    const championshipId = req.params.id as string
    const { groupsCount, participantsPerGroup, advancePerGroup } = req.body

    const championship = await prisma.championship.findUnique({
        where: { id: championshipId },
        include: { registrations: { where: { status: 'APPROVED' } } }
    })

    if (!championship) throw new AppError('Campeonato não encontrado', 404)
    if (championship.registrations.length === 0) throw new AppError('Nenhuma inscrição aprovada', 400)

    const registrations = [...championship.registrations].sort(() => Math.random() - 0.5)
    const count = participantsPerGroup ? Math.ceil(registrations.length / participantsPerGroup) : (groupsCount || championship.groupsCount || 4)

    await prisma.championship.update({
        where: { id: championshipId },
        data: {
            groupsCount: count,
            advancePerGroup: advancePerGroup || championship.advancePerGroup || 2
        }
    })

    // Delete existing groups and matches for this championship
    await prisma.group.deleteMany({ where: { championshipId } })
    await prisma.match.deleteMany({ where: { championshipId, phase: 'GROUP' } })
    
    const groups = []
    for (let i = 0; i < count; i++) {
        const groupName = `Grupo ${String.fromCharCode(65 + i)}`
        const group = await prisma.group.create({
            data: {
                name: groupName,
                championshipId
            }
        })
        groups.push(group)
    }

    // Assign registrations to groups
    for (let i = 0; i < registrations.length; i++) {
        const groupIndex = i % count
        await prisma.registration.update({
            where: { id: registrations[i].id },
            data: { groupId: groups[groupIndex].id }
        })
    }

    // Manual match creation requested - skipping auto-generation of Round Robin matches
    /*
    for (const group of groups) {
        ...
    }
    */

    return res.json({ message: 'Grupos e partidas gerados com sucesso', groupsCount: count })
}

export async function generateBrackets(req: Request, res: Response) {
    const championshipId = req.params.id as string
    
    const championship = await prisma.championship.findUnique({
        where: { id: championshipId },
        include: { registrations: { where: { status: 'APPROVED' } } }
    })

    if (!championship) throw new AppError('Campeonato não encontrado', 404)

    // Simplified: Generate brackets
    await prisma.match.deleteMany({ where: { championshipId, phase: { not: 'GROUP' } } })

    let participants = []

    if (championship.format === 'GROUPS_PLUS_KNOCKOUT' || championship.format === 'ROUND_ROBIN') {
        const standingsRes = await calculateStandings(championshipId)
        const advanceCount = championship.advancePerGroup || 2
        for (const group of standingsRes) {
            const qualified = group.table.slice(0, advanceCount)
            for (const team of qualified) {
                const reg = championship.registrations.find(r => r.teamId === team.id || r.userId === team.id)
                if (reg) participants.push(reg)
            }
        }
    } else {
        participants = [...championship.registrations].sort(() => Math.random() - 0.5)
    }

    if (participants.length === 0) throw new AppError('Não há participantes suficientes para gerar chaves', 400)

    const powerOfTwo = Math.pow(2, Math.ceil(Math.log2(participants.length)))
    
    // Create all rounds at once
    let roundsCount = Math.log2(powerOfTwo)
    let currentRoundMatches = []
    let previousRoundMatches = []

    // Manual match creation requested - skipping auto-generation of bracket matches
    /*
    for (let r = roundsCount; r >= 1; r--) {
        ...
    }
    */

    // Now fill the first round with participants
    const firstRoundMatches = await prisma.match.findMany({
        where: { championshipId, round: 1 },
        orderBy: { bracketOrder: 'asc' }
    })

    for (let i = 0; i < firstRoundMatches.length; i++) {
        const p1 = participants[i * 2]
        const p2 = participants[i * 2 + 1]
        
        await prisma.match.update({
            where: { id: firstRoundMatches[i].id },
            data: {
                team1Id: championship.registrationType === 'TEAM' ? p1?.teamId : null,
                team2Id: championship.registrationType === 'TEAM' ? p2?.teamId : null,
                player1Id: championship.registrationType === 'INDIVIDUAL' ? p1?.userId : null,
                player2Id: championship.registrationType === 'INDIVIDUAL' ? p2?.userId : null,
                status: p1 && p2 ? 'SCHEDULED' : 'FINISHED',
                winnerId: !p2 ? p1?.userId || p1?.teamId : null,
                isWalkover: !p2
            }
        })

        // If it's a bye, move p1 to the next match immediately
        if (!p2 && p1 && firstRoundMatches[i].nextMatchId) {
             const nextMatch = await prisma.match.findUnique({ where: { id: firstRoundMatches[i].nextMatchId! } })
             if (nextMatch) {
                const side = firstRoundMatches[i].bracketOrder! % 2 === 0 ? '1' : '2'
                await prisma.match.update({
                    where: { id: nextMatch.id },
                    data: {
                        [`team${side}Id`]: championship.registrationType === 'TEAM' ? p1.teamId : null,
                        [`player${side}Id`]: championship.registrationType === 'INDIVIDUAL' ? p1.userId : null
                    }
                })
             }
        }
    }

    return res.json({ message: 'Chaves de mata-mata geradas com sucesso' })
}

export async function getStandings(req: Request, res: Response) {
    const championshipId = req.params.id as string
    const standings = await calculateStandings(championshipId)
    return res.json(standings)
}

export async function calculateStandings(championshipId: string) {
    const championship = await prisma.championship.findUnique({
        where: { id: championshipId },
        include: {
            registrations: {
                where: { status: 'APPROVED' },
                include: { user: true, team: true }
            },
            matches: {
                where: { status: 'FINISHED' }
            },
            groups: {
                include: {
                    participants: {
                        include: { user: true, team: true }
                    },
                    matches: {
                        where: { status: 'FINISHED' }
                    }
                }
            }
        }

    })

    if (!championship) return []

    // For ROUND_ROBIN, always use a single general classification
    // For other formats, use groups if they exist
    if (championship.format !== 'ROUND_ROBIN' && championship.groups.length > 0) {
        return championship.groups.map(group => {
            const table = group.participants.map(p => {
                const participantId = p.teamId || p.userId
                const participantMatches = group.matches.filter(m => 
                    m.team1Id === participantId || m.team2Id === participantId || 
                    m.player1Id === participantId || m.player2Id === participantId
                )

                return calculateParticipantStats(participantId, participantMatches, p)
            }).sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor)

            return { id: group.id, name: group.name, table }
        })
    }

    // If ROUND_ROBIN or no groups yet, calculate as a single classification
    const table = championship.registrations.map(p => {
        const participantId = p.teamId || p.userId
        const participantMatches = championship.matches.filter(m => 
            m.team1Id === participantId || m.team2Id === participantId || 
            m.player1Id === participantId || m.player2Id === participantId
        )

        return calculateParticipantStats(participantId, participantMatches, p)
    }).sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor)

    return [{
        id: 'general',
        name: championship.format === 'ROUND_ROBIN' ? 'Classificação Geral' : 'Classificação Provisória',
        table
    }]
}

function calculateParticipantStats(participantId: string, matches: any[], p: any) {
    let points = 0
    let played = matches.length
    let won = 0, drawn = 0, lost = 0
    let goalsFor = 0, goalsAgainst = 0

    matches.forEach(m => {
        const isP1 = m.team1Id === participantId || m.player1Id === participantId
        const myScore = isP1 ? m.score1 : m.score2
        const opScore = isP1 ? m.score2 : m.score1

        goalsFor += myScore
        goalsAgainst += opScore

        if (myScore > opScore) {
            points += 3
            won++
        } else if (myScore === opScore) {
            points += 1
            drawn++
        } else {
            lost++
        }
    })

    return {
        id: participantId,
        name: p.team?.name || p.user?.name || '---',
        points,
        played,
        won,
        drawn,
        lost,
        goalsFor,
        goalsAgainst,
        goalDifference: goalsFor - goalsAgainst
    }
}
