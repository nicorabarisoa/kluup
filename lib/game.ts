import { supabase } from './supabase'
import { BSubtype, GameState, GroupTitleKey, Question, SessionStats } from './types'

const B_SUBTYPE_WEIGHTS: Record<string, { B1: number }> = {
  'hello-stranger': { B1: 0.3 },
  'apero': { B1: 0.3 },
  'no-filter': { B1: 0.7 },
  'unmasked': { B1: 0.7 },
}

export function pickBSubtype(theme: string): BSubtype {
  const w = B_SUBTYPE_WEIGHTS[theme] ?? { B1: 0.5 }
  return Math.random() < w.B1 ? 'B1' : 'B2'
}

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5)
}

// Type dominance per theme (cf. CLAUDE.md). Higher weight = more frequent rounds.
type QType = 'A' | 'B' | 'C'
const TYPE_WEIGHTS: Record<string, Record<QType, number>> = {
  'hello-stranger': { A: 1, B: 3, C: 2 }, // B dominant
  'apero': { A: 2, B: 3, C: 2 },          // B + A
  'no-filter': { A: 4, B: 2, C: 1 },      // A dominant
  'unmasked': { A: 4, B: 2, C: 1 },       // A pur
}

function pickType(theme: string, exclude?: QType): QType {
  const base = TYPE_WEIGHTS[theme] ?? { A: 1, B: 1, C: 1 }
  const w: Record<QType, number> = { A: base.A, B: base.B, C: base.C }
  // Avoid repeating the previous round's type — chaining the same type isn't fun.
  if (exclude) w[exclude] = 0
  let total = w.A + w.B + w.C
  // Safety: if excluding zeroed everything, fall back to the full weights.
  if (total === 0) { w.A = base.A; w.B = base.B; w.C = base.C; total = w.A + w.B + w.C }
  let r = Math.random() * total
  if ((r -= w.A) < 0) return 'A'
  if ((r -= w.B) < 0) return 'B'
  return 'C'
}

// A round has a SINGLE type. We pick the round's type (weighted by theme), then
// return 3 questions of that type — preferring the target intensity, filling
// from other intensities of the same type if needed. Falls back to another type
// only if the preferred type has no unplayed questions left.
export async function pickCandidates(
  theme: string,
  round: number,
  playedIds: string[],
  lastType?: 'A' | 'B' | 'C'
): Promise<Question[]> {
  const intensity = round <= 3 ? 1 : round <= 6 ? 2 : 3

  // Prefer a type different from the previous round; the tail still includes it
  // as a fallback if no other type has unplayed questions left.
  const preferred = pickType(theme, lastType)
  const typeOrder: QType[] = [preferred, ...(['A', 'B', 'C'] as QType[]).filter((t) => t !== preferred)]

  for (const type of typeOrder) {
    let query = supabase
      .from('questions')
      .select()
      .eq('theme', theme)
      .eq('type', type)

    if (playedIds.length > 0) {
      query = query.not('id', 'in', `(${playedIds.join(',')})`)
    }

    const { data } = await query
    const pool = (data ?? []) as Question[]
    if (pool.length === 0) continue

    // Prefer the target intensity, then fill with other intensities of same type.
    const atIntensity = shuffle(pool.filter((q) => q.intensity === intensity))
    const others = shuffle(pool.filter((q) => q.intensity !== intensity))
    return [...atIntensity, ...others].slice(0, 3)
  }

  return []
}

const emptyStats = (): SessionStats => ({
  rounds_a: 0, rounds_b: 0, rounds_b1: 0, rounds_b2: 0, rounds_c: 0, volunteers: 0,
})

export function makeInitialGameState(candidates: Question[]): GameState {
  return {
    phase: 'voting_question',
    round: 1,
    candidates,
    current_question: null,
    b_subtype: null,
    designated_player_id: null,
    designated_player_ids: [],
    designation_tie_all: false,
    revealed_player_ids: [],
    yes_percentage: null,
    volunteer_player_ids: [],
    played_question_ids: [],
    paused: false,
    stats: emptyStats(),
    b2_revealed: false,
  }
}

export function accumulateStats(gs: GameState): SessionStats {
  const s = { ...gs.stats }
  const q = gs.current_question
  if (!q) return s

  if (q.type === 'A') {
    s.rounds_a++
  } else if (q.type === 'B') {
    s.rounds_b++
    if (gs.b_subtype === 'B1') s.rounds_b1++
    else if (gs.b_subtype === 'B2') s.rounds_b2++
  } else if (q.type === 'C') {
    s.rounds_c++
    // A round with volunteers ends on the volunteers-reveal phase.
    if (gs.phase === 'round_c_volunteers_reveal') s.volunteers++
  }

  return s
}

export function computeGroupTitle(stats: SessionStats, theme: string, totalRounds: number): GroupTitleKey {
  const { rounds_a, rounds_b, rounds_b1, rounds_c, volunteers } = stats
  const pctA = totalRounds > 0 ? rounds_a / totalRounds : 0
  const pctB = totalRounds > 0 ? rounds_b / totalRounds : 0
  const pctC = totalRounds > 0 ? rounds_c / totalRounds : 0
  const pctB1ofB = rounds_b > 0 ? rounds_b1 / rounds_b : 0
  const volunteerRate = rounds_c > 0 ? volunteers / rounds_c : 0

  if ((theme === 'no-filter' || theme === 'unmasked') && pctA > 0.5) return 'title_nofilter'
  if (theme === 'unmasked' && pctB > 0.4 && pctB1ofB > 0.6) return 'title_daring'
  if (pctB > 0.5 && pctB1ofB < 0.4) return 'title_unfathomable'
  if (pctB > 0.5 && pctB1ofB >= 0.6) return 'title_transparent'
  if (pctB > 0.5) return 'title_mysterious'
  if (pctC > 0.4 && volunteerRate >= 0.6) return 'title_brave'
  if (pctC > 0.4 && volunteerRate < 0.3) return 'title_cautious'
  if (pctA > 0.6) return 'title_ruthless'
  if (theme === 'hello-stranger' && totalRounds >= 5) return 'title_accomplices'
  return 'title_unclassifiable'
}

export async function updateRoomGameState(roomId: string, gs: GameState) {
  const status = gs.phase === 'ended' ? 'ended' : 'playing'
  return supabase.from('rooms').update({ game_state: gs, status }).eq('id', roomId)
}

export async function countVotes(
  roomId: string,
  round: number,
  voteType: string
): Promise<number> {
  const { count } = await supabase
    .from('votes')
    .select('*', { count: 'exact', head: true })
    .eq('room_id', roomId)
    .eq('round', round)
    .eq('vote_type', voteType)

  return count ?? 0
}

// Type C runs one phase where players cast EITHER a volunteer or a designation
// vote, so the "everyone acted" threshold counts both types together.
export async function countChoiceVotes(roomId: string, round: number): Promise<number> {
  const { count } = await supabase
    .from('votes')
    .select('*', { count: 'exact', head: true })
    .eq('room_id', roomId)
    .eq('round', round)
    .in('vote_type', ['volunteer', 'designation'])

  return count ?? 0
}

export async function fetchVotes(
  roomId: string,
  round: number,
  voteType: string
) {
  const { data } = await supabase
    .from('votes')
    .select()
    .eq('room_id', roomId)
    .eq('round', round)
    .eq('vote_type', voteType)

  return data ?? []
}

export type DesignationResult = {
  // The most-voted player(s). 1 = clear winner, >1 = tie among leaders (all shown).
  topIds: string[]
  // True when the leading group is literally everyone — nobody stood out.
  tieAll: boolean
}

// Tally a designation vote WITHOUT random tie-breaking: ties are surfaced as-is
// so the UI can show every leader (or call out a full tie).
export function tallyDesignation(
  votes: { target_player_id: string | null }[],
  playerCount: number
): DesignationResult {
  const counts: Record<string, number> = {}
  for (const v of votes) {
    if (v.target_player_id) {
      counts[v.target_player_id] = (counts[v.target_player_id] ?? 0) + 1
    }
  }
  const ids = Object.keys(counts)
  // No usable votes → treat as "nobody stood out".
  if (ids.length === 0) return { topIds: [], tieAll: true }

  const max = Math.max(...Object.values(counts))
  const topIds = ids.filter((id) => counts[id] === max)
  // Everyone is tied only when the leading group covers the whole group.
  const tieAll = playerCount > 1 && topIds.length >= playerCount
  return { topIds, tieAll }
}

// Returns the question index that received the most votes (ties broken randomly)
export function tallyQuestionSelection(votes: { question_index: number | null }[]): number {
  const counts: Record<number, number> = {}
  for (const v of votes) {
    if (v.question_index != null) {
      counts[v.question_index] = (counts[v.question_index] ?? 0) + 1
    }
  }
  if (Object.keys(counts).length === 0) return 0
  const max = Math.max(...Object.values(counts))
  const winners = Object.entries(counts)
    .filter(([, n]) => n === max)
    .map(([idx]) => Number(idx))
  return winners[Math.floor(Math.random() * winners.length)]
}
