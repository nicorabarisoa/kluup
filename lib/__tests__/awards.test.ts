/**
 * Red test scaffolds for computeDuoAwards (Wave 0 — Plan 06-01).
 * These tests FAIL until lib/awards.ts is created in Wave 1 (Plan 06-03).
 * Expected Wave 0 state: "Cannot find module '../awards'" import error.
 *
 * Fixture vote shapes match the Supabase votes table:
 *   { id, round, player_id, vote_type, target_player_id, answer }
 * Where `answer` is boolean (true/false), NOT the string 'oui'.
 *
 * P-19: determinism test verifies same player array in different orders → identical awards.
 */
import { describe, test, expect } from 'vitest'
import { computeDuoAwards } from '../awards'

// ---------------------------------------------------------------------------
// Minimal fixtures
// ---------------------------------------------------------------------------

type PlayerFixture = { id: string; pseudo: string; is_host: boolean; room_id: string }
type VoteFixture = {
  id: string
  round: number
  player_id: string
  vote_type: 'designation' | 'confession' | 'volunteer' | 'question_selection'
  target_player_id: string | null
  answer: boolean | null
}

let voteCounter = 0
const makeVote = (
  overrides: Partial<VoteFixture> & Pick<VoteFixture, 'round' | 'player_id' | 'vote_type'>
): VoteFixture => ({
  id: `vote-${++voteCounter}`,
  target_player_id: null,
  answer: null,
  ...overrides,
})

const makePlayer = (id: string, pseudo: string, isHost = false): PlayerFixture => ({
  id,
  pseudo,
  is_host: isHost,
  room_id: 'room-test',
})

// Three players for multi-pair tests
const PA = makePlayer('player-aaa', 'Alice', true)
const PB = makePlayer('player-bbb', 'Bob')
const PC = makePlayer('player-ccc', 'Charlie')

// ---------------------------------------------------------------------------
// computeDuoAwards tests
// ---------------------------------------------------------------------------

describe('computeDuoAwards', () => {
  test('returns [] when no pair reaches score >= 2 for any metric', () => {
    // Only 1 mutual designation each — below threshold of 2
    const votes: VoteFixture[] = [
      makeVote({ round: 1, player_id: PA.id, vote_type: 'designation', target_player_id: PB.id }),
      makeVote({ round: 1, player_id: PB.id, vote_type: 'designation', target_player_id: PA.id }),
      // Only 1 round of mutual designation — score=1 < threshold=2
    ]
    const result = computeDuoAwards(votes, [PA, PB, PC])
    expect(result).toEqual([])
  })

  test('threshold: a pair with mutual_designations >= 2 earns award_magnetisme', () => {
    // A designates B and B designates A in 2 rounds → mutual_designations = 2
    const votes: VoteFixture[] = [
      makeVote({ round: 1, player_id: PA.id, vote_type: 'designation', target_player_id: PB.id }),
      makeVote({ round: 1, player_id: PB.id, vote_type: 'designation', target_player_id: PA.id }),
      makeVote({ round: 2, player_id: PA.id, vote_type: 'designation', target_player_id: PB.id }),
      makeVote({ round: 2, player_id: PB.id, vote_type: 'designation', target_player_id: PA.id }),
    ]
    const result = computeDuoAwards(votes, [PA, PB, PC])
    const magnetisme = result.find(a => a.awardKey === 'award_magnetisme')
    expect(magnetisme).toBeDefined()
    expect(magnetisme!.playerA.id).toBeDefined()
    expect(magnetisme!.playerB.id).toBeDefined()
    // The awarded pair should be A-B (the only pair with mutual designations)
    const pairIds = [magnetisme!.playerA.id, magnetisme!.playerB.id].sort()
    expect(pairIds).toEqual([PA.id, PB.id].sort())
  })

  test('variety rule: when A-B leads two metrics, second award prefers a different pair if tied', () => {
    // A-B: mutual_designations = 3 → award_magnetisme
    // A-B and A-C both have vote_alignment = 2 → variety rule prefers A-C (not already awarded)
    const votes: VoteFixture[] = [
      // Mutual designations A↔B rounds 1,2,3 → mutual_designations(A,B)=3
      makeVote({ round: 1, player_id: PA.id, vote_type: 'designation', target_player_id: PB.id }),
      makeVote({ round: 1, player_id: PB.id, vote_type: 'designation', target_player_id: PA.id }),
      makeVote({ round: 2, player_id: PA.id, vote_type: 'designation', target_player_id: PB.id }),
      makeVote({ round: 2, player_id: PB.id, vote_type: 'designation', target_player_id: PA.id }),
      makeVote({ round: 3, player_id: PA.id, vote_type: 'designation', target_player_id: PB.id }),
      makeVote({ round: 3, player_id: PB.id, vote_type: 'designation', target_player_id: PA.id }),
      // A and B both target C in rounds 4,5 → vote_alignment(A,B)=2 (same target C)
      makeVote({ round: 4, player_id: PA.id, vote_type: 'designation', target_player_id: PC.id }),
      makeVote({ round: 4, player_id: PB.id, vote_type: 'designation', target_player_id: PC.id }),
      makeVote({ round: 5, player_id: PA.id, vote_type: 'designation', target_player_id: PC.id }),
      makeVote({ round: 5, player_id: PB.id, vote_type: 'designation', target_player_id: PC.id }),
      // A and C both target B in rounds 4,5 → vote_alignment(A,C)=2 (tied with A-B)
      makeVote({ round: 4, player_id: PC.id, vote_type: 'designation', target_player_id: PB.id }),
      makeVote({ round: 5, player_id: PC.id, vote_type: 'designation', target_player_id: PB.id }),
    ]
    const result = computeDuoAwards(votes, [PA, PB, PC])

    // award_magnetisme should go to A-B
    const magnetisme = result.find(a => a.awardKey === 'award_magnetisme')
    expect(magnetisme).toBeDefined()

    // award_longueur_onde: A-B and A-C both have alignment=2, but A-B already has magnetisme
    // variety rule should prefer A-C (or B-C if they also tie)
    const longueur = result.find(a => a.awardKey === 'award_longueur_onde')
    if (longueur) {
      // If variety rule works, the awarded pair should not be the same as magnetisme's pair
      const magnetismePairIds = [magnetisme!.playerA.id, magnetisme!.playerB.id].sort().join(':')
      const longueurPairIds = [longueur.playerA.id, longueur.playerB.id].sort().join(':')
      // Variety rule: prefer a different pair when scores are tied
      expect(longueurPairIds).not.toBe(magnetismePairIds)
    }
  })

  // ---------------------------------------------------------------------------
  // P-19: Determinism — same players in different array orders → identical awards
  // ---------------------------------------------------------------------------

  describe('P-19: determinism — pair sort by player.id', () => {
    test('same votes + different player array order → identical award assignments', () => {
      // Two rounds of mutual designation A↔B → award_magnetisme for A-B pair
      const votes: VoteFixture[] = [
        makeVote({ round: 1, player_id: PA.id, vote_type: 'designation', target_player_id: PB.id }),
        makeVote({ round: 1, player_id: PB.id, vote_type: 'designation', target_player_id: PA.id }),
        makeVote({ round: 2, player_id: PA.id, vote_type: 'designation', target_player_id: PB.id }),
        makeVote({ round: 2, player_id: PB.id, vote_type: 'designation', target_player_id: PA.id }),
      ]

      // Order 1: [PA, PB, PC]
      const result1 = computeDuoAwards(votes, [PA, PB, PC])
      // Order 2: [PC, PB, PA] — reversed
      const result2 = computeDuoAwards(votes, [PC, PB, PA])
      // Order 3: [PB, PC, PA] — shuffled
      const result3 = computeDuoAwards(votes, [PB, PC, PA])

      // Normalize to compare: extract awardKey + sorted pair IDs
      const normalize = (awards: typeof result1) =>
        awards.map(a => ({
          awardKey: a.awardKey,
          pair: [a.playerA.id, a.playerB.id].sort().join(':'),
        }))

      expect(normalize(result1)).toEqual(normalize(result2))
      expect(normalize(result1)).toEqual(normalize(result3))
    })

    test('player.id ordering: lexicographically earlier id becomes playerA', () => {
      // PA.id = 'player-aaa', PB.id = 'player-bbb'
      // After sort by id: PA < PB → PA should be playerA in the pair
      const votes: VoteFixture[] = [
        makeVote({ round: 1, player_id: PA.id, vote_type: 'designation', target_player_id: PB.id }),
        makeVote({ round: 1, player_id: PB.id, vote_type: 'designation', target_player_id: PA.id }),
        makeVote({ round: 2, player_id: PA.id, vote_type: 'designation', target_player_id: PB.id }),
        makeVote({ round: 2, player_id: PB.id, vote_type: 'designation', target_player_id: PA.id }),
      ]
      const result = computeDuoAwards(votes, [PB, PA]) // intentionally reversed input
      const magnetisme = result.find(a => a.awardKey === 'award_magnetisme')
      expect(magnetisme).toBeDefined()
      // playerA should be the lexicographically smaller id
      expect(magnetisme!.playerA.id < magnetisme!.playerB.id).toBe(true)
    })
  })
})
