import { Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { AppError } from '../middlewares/error.middleware'

export async function generateGroups(req: Request, res: Response) {
    const { championshipId } = req.params
    const { groupsCount } = req.body

    const championship = await prisma.championship.findUnique({
        where: { id: championshipId },
        include: { registrations: { where: { status: 'APPROVED' } } }
    })

    if (!championship) throw new AppError('Campeonato não encontrado', 404)
    if (championship.registrations.length === 0) throw new AppError('Nenhuma inscrição aprovada', 400)

    // Delete existing groups and matches for this championship
    await prisma.group.deleteMany({ where: { championshipId } })
    await prisma.match.deleteMany({ where: { championshipId, phase: 'GROUP' } })

    const registrations = [...championship.registrations].sort(() => Math.random() - 0.5)
    const count = groupsCount || championship.groupsCount || 4
    
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

    // Generate Round Robin matches for each group
    for (const group of groups) {
        const groupRegs = await prisma.registration.findMany({
            where: { groupId: group.id }
        })

        for (let i = 0; i < groupRegs.length; i++) {
            for (let j = i + 1; j < groupRegs.length; j++) {
                await prisma.match.create({
                    data: {
                        championshipId,
                        groupId: group.id,
                        phase: 'GROUP',
                        date: championship.startDate,
                        team1Id: championship.registrationType === 'TEAM' ? groupRegs[i].teamId : null,
                        team2Id: championship.registrationType === 'TEAM' ? groupRegs[j].teamId : null,
                        player1Id: championship.registrationType === 'INDIVIDUAL' ? groupRegs[i].userId : null,
                        player2Id: championship.registrationType === 'INDIVIDUAL' ? groupRegs[j].userId : null,
                        status: 'SCHEDULED'
                    }
                })
            }
        }
    }

    return res.json({ message: 'Grupos e partidas gerados com sucesso', groupsCount: count })
}

export async function generateBrackets(req: Request, res: Response) {
    const { championshipId } = req.params
    
    const championship = await prisma.championship.findUnique({
        where: { id: championshipId },
        include: { registrations: { where: { status: 'APPROVED' } } }
    })

    if (!championship) throw new AppError('Campeonato não encontrado', 404)

    // Simplified: Generate brackets from all approved registrations (Knockout only)
    await prisma.match.deleteMany({ where: { championshipId, phase: { not: 'GROUP' } } })

    const participants = [...championship.registrations].sort(() => Math.random() - 0.5)
    const powerOfTwo = Math.pow(2, Math.ceil(Math.log2(participants.length)))
    
    // Create all rounds at once
    let roundsCount = Math.log2(powerOfTwo)
    let currentRoundMatches = []
    let previousRoundMatches = []

    for (let r = roundsCount; r >= 1; r--) {
        const matchesInRound = Math.pow(2, r - 1)
        const roundMatches = []
        
        for (let i = 0; i < matchesInRound; i++) {
            const match = await prisma.match.create({
                data: {
                    championshipId,
                    phase: r === roundsCount ? 'FINAL' : r === roundsCount - 1 ? 'SEMIFINAL' : `ROUND_OF_${Math.pow(2, r)}`,
                    round: r,
                    bracketOrder: i,
                    date: championship.startDate,
                    status: 'SCHEDULED'
                }
            })
            roundMatches.push(match)

            // Link previous round matches to this one
            if (previousRoundMatches.length > 0) {
                const m1 = previousRoundMatches[i * 2]
                const m2 = previousRoundMatches[i * 2 + 1]
                if (m1) await prisma.match.update({ where: { id: m1.id }, data: { nextMatchId: match.id } })
                if (m2) await prisma.match.update({ where: { id: m2.id }, data: { nextMatchId: match.id } })
            }
        }
        previousRoundMatches = roundMatches
        if (r === 1) currentRoundMatches = roundMatches
    }

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
    const { championshipId } = req.params

    const groups = await prisma.group.findMany({
        where: { championshipId },
        include: {
            participants: {
                include: {
                    user: true,
                    team: true
                }
            },
            matches: {
                where: { status: 'FINISHED' }
            }
        }
    })

    const standings = groups.map(group => {
        const table = group.participants.map(p => {
            const participantId = p.teamId || p.userId
            const participantMatches = group.matches.filter(m => 
                m.team1Id === participantId || m.team2Id === participantId || 
                m.player1Id === participantId || m.player2Id === participantId
            )

            let points = 0
            let played = participantMatches.length
            let won = 0, drawn = 0, lost = 0
            let goalsFor = 0, goalsAgainst = 0

            participantMatches.forEach(m => {
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
                name: p.team?.name || p.user.name,
                points,
                played,
                won,
                drawn,
                lost,
                goalsFor,
                goalsAgainst,
                goalDifference: goalsFor - goalsAgainst
            }
        }).sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor)

        return {
            id: group.id,
            name: group.name,
            table
        }
    })

    return res.json(standings)
}
