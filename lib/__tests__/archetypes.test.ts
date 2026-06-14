/**
 * Red test scaffolds for computeTraitScores + computeArchetype (Wave 0 — Plan 06-01).
 * These tests FAIL until lib/archetypes.ts is created in Wave 1 (Plan 06-02).
 * Expected Wave 0 state: "Cannot find module '../archetypes'" import error.
 *
 * Fixture vote shapes match the Supabase votes table:
 *   { id, round, player_id, vote_type, target_player_id, answer }
 * Where `answer` is boolean (true/false), NOT the string 'oui'.
 */
import { describe, test, expect } from 'vitest'
import { computeArchetype, computeTraitScores } from '../archetypes'

// ---------------------------------------------------------------------------
// Minimal fixtures
// ---------------------------------------------------------------------------

const MY_ID = 'player-a'
const OTHER_ID = 'player-b'

type VoteFixture = {
  id: string
  round: number
  player_id: string
  vote_type: 'designation' | 'confession' | 'volunteer' | 'question_selection'
  target_player_id: string | null
  answer: boolean | null
}

const makeVote = (overrides: Partial<VoteFixture> & Pick<VoteFixture, 'round' | 'player_id' | 'vote_type'>): VoteFixture => ({
  id: `vote-${Math.random()}`,
  target_player_id: null,
  answer: null,
  ...overrides,
})

/** Minimal played questions — tags drive archetype trait scores. */
const Q_DROLE = {
  id: 'q1',
  theme: 'apero',
  type: 'A' as const,
  intensity: 1,
  question: { fr: 'Test A', en: 'Test A', es: 'Test A', de: 'Test A' },
  tags: [{ tag: 'drole', points: 5 }],
}

const Q_EMPATHIQUE = {
  id: 'q2',
  theme: 'apero',
  type: 'B' as const,
  intensity: 1,
  question: { fr: 'Test B', en: 'Test B', es: 'Test B', de: 'Test B' },
  tags: [{ tag: 'empathique', points: 3 }, { tag: 'drole', points: 1 }],
}

const Q_FIABLE = {
  id: 'q3',
  theme: 'apero',
  type: 'A' as const,
  intensity: 1,
  question: { fr: 'Test C', en: 'Test C', es: 'Test C', de: 'Test C' },
  tags: [{ tag: 'fiable', points: 2 }],
}

/** Minimal GameState stub — only played_question_ids is needed for round-question mapping. */
const makeGS = (played_question_ids: string[]) => ({
  phase: 'ended' as const,
  round: 3,
  candidates: [],
  current_question: null,
  b_subtype: null,
  designated_player_id: null,
  designated_player_ids: [],
  designation_tie_all: false,
  revealed_player_ids: [],
  yes_percentage: null,
  volunteer_player_ids: [],
  played_question_ids,
  paused: false,
  stats: {
    rounds_a: 2, rounds_b: 1, rounds_b1: 0, rounds_b2: 1, rounds_c: 0,
    volunteers: 0,
    designated: {}, confessed: {}, volunteered: {},
  },
  b2_revealed: false,
  session_uuid: 'test-session',
  round_started_at: '',
  vote_round_player_count: 2,
})

// ---------------------------------------------------------------------------
// computeArchetype tests (pure — no votes needed)
// ---------------------------------------------------------------------------

describe('computeArchetype', () => {
  test('simple archetype: drole dominant (>50%)', () => {
    // drole=10, total=17, drole pct=58.8% > 50% → archetype_farceur
    const scores = {
      drole: 10,
      fiable: 3,
      audacieux: 2,
      empathique: 1,
      mysterieux: 1,
      romantique: 0,
    }
    const result = computeArchetype(scores)
    expect(result.archetypeKey).toBe('archetype_farceur')
  })

  test('hybrid archetype: drole+empathique co-dominant', () => {
    // drole=5, empathique=4, fiable=1, total=10
    // drole=50%, empathique=40% — neither >50% (simple fails)
    // both >25%, gap=10% < 15% → hybrid → archetype_ame_fete
    const scores = {
      drole: 5,
      empathique: 4,
      fiable: 1,
      audacieux: 0,
      mysterieux: 0,
      romantique: 0,
    }
    const result = computeArchetype(scores)
    expect(result.archetypeKey).toBe('archetype_ame_fete')
  })

  test('fallback: all-zero scores → archetype_fallback', () => {
    const scores = {
      drole: 0,
      fiable: 0,
      audacieux: 0,
      empathique: 0,
      mysterieux: 0,
      romantique: 0,
    }
    const result = computeArchetype(scores)
    expect(result.archetypeKey).toBe('archetype_fallback')
  })

  test('topTraits: result contains up to 3 traits with pct > 0', () => {
    const scores = {
      drole: 10,
      fiable: 3,
      audacieux: 2,
      empathique: 1,
      mysterieux: 1,
      romantique: 0,
    }
    const result = computeArchetype(scores)
    // Top 3 traits with points > 0, sorted desc
    expect(result.topTraits.length).toBeLessThanOrEqual(3)
    expect(result.topTraits.length).toBeGreaterThan(0)
    // All pct values should be > 0
    for (const t of result.topTraits) {
      expect(t.pct).toBeGreaterThan(0)
    }
    // First trait should be drole (highest score)
    expect(result.topTraits[0].key).toBe('drole')
  })
})

// ---------------------------------------------------------------------------
// computeTraitScores tests (floor-at-zero + actor determination)
// ---------------------------------------------------------------------------

describe('computeTraitScores', () => {
  test('floor-at-zero: negative trait total never produces a negative pct', () => {
    // A question with negative points for a trait — scores must floor at 0.
    const qNegative = {
      id: 'q-neg',
      theme: 'apero',
      type: 'A' as const,
      intensity: 1,
      question: { fr: 'Neg', en: 'Neg', es: 'Neg', de: 'Neg' },
      tags: [{ tag: 'drole', points: -5 }],
    }
    // Player was designated in round 1 (Type A actor)
    const votes: VoteFixture[] = [
      makeVote({ round: 1, player_id: OTHER_ID, vote_type: 'designation', target_player_id: MY_ID }),
      makeVote({ round: 1, player_id: OTHER_ID, vote_type: 'designation', target_player_id: MY_ID }),
    ]
    const myVotes = votes.filter(v => v.player_id === MY_ID)
    const gs = makeGS(['q-neg'])
    const scores = computeTraitScores(myVotes, [qNegative], gs)
    // All trait scores must be >= 0
    for (const val of Object.values(scores)) {
      expect(val).toBeGreaterThanOrEqual(0)
    }
  })

  test('Type B confession: actor determined from own vote (answer: true), never from gs fields', () => {
    // Player confessed (answer: true) in round 1 (Type B question)
    // Privacy rule P-04: use vote_type='confession' AND answer=true, not gs.revealed_player_ids
    const votes: VoteFixture[] = [
      makeVote({ round: 1, player_id: MY_ID, vote_type: 'confession', answer: true }),
    ]
    const gs = makeGS([Q_EMPATHIQUE.id])
    const scores = computeTraitScores(votes, [Q_EMPATHIQUE], gs)
    // Q_EMPATHIQUE has empathique:3 + drole:1 → player (who confessed) earns those points
    expect(scores.empathique).toBeGreaterThan(0)
    expect(scores.drole).toBeGreaterThan(0)
  })

  test('fixture confession votes use answer: true (boolean), never the string "oui"', () => {
    // This test documents the fixture convention: boolean answer, not string.
    const confessionVote = makeVote({
      round: 1,
      player_id: MY_ID,
      vote_type: 'confession',
      answer: true,
    })
    // Verify the answer field is boolean true, not the string 'oui'
    expect(typeof confessionVote.answer).toBe('boolean')
    expect(confessionVote.answer).toBe(true)
    expect(confessionVote.answer).not.toBe('oui')
  })
})
