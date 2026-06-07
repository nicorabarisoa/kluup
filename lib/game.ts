import { supabase } from './supabase'
import { GameState, GroupTitleKey, Question, SessionStats } from './types'

// Confession (Type B) is always a roulette now — the B1/B2 sub-mode split was
// removed after playtest. b_subtype stays 'B2' for stats continuity.

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
// return 3 RANDOM unplayed questions of that type. Intensity is intentionally
// IGNORED — the theme already bounds the overall spice; ignoring the intensity
// ramp makes the run unpredictable (no light→deep ordering). Falls back to
// another type only if the preferred type has no unplayed questions left.
// (`round` is kept in the signature for callers but no longer drives selection.)
export async function pickCandidates(
  theme: string,
  _round: number,
  playedIds: string[],
  lastType?: 'A' | 'B' | 'C'
): Promise<Question[]> {
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

    // Random pick regardless of intensity.
    return shuffle(pool).slice(0, 3)
  }

  return []
}

const emptyStats = (): SessionStats => ({
  rounds_a: 0, rounds_b: 0, rounds_b1: 0, rounds_b2: 0, rounds_c: 0, volunteers: 0,
  designated: {}, confessed: {}, volunteered: {},
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
  const s: SessionStats = {
    ...gs.stats,
    // Shallow-clone the per-player maps so we don't mutate the previous object.
    // Default to {} for games started before this field existed.
    designated: { ...(gs.stats.designated ?? {}) },
    confessed:  { ...(gs.stats.confessed  ?? {}) },
    volunteered: { ...(gs.stats.volunteered ?? {}) },
  }
  const q = gs.current_question
  if (!q) return s

  // Helper: increment a per-player counter (only for non-null ids).
  const inc = (map: Record<string, number>, id: string | null | undefined) => {
    if (id) map[id] = (map[id] ?? 0) + 1
  }

  if (q.type === 'A') {
    s.rounds_a++
    // Track top designees — only when someone actually stood out (not tie-all).
    if (!gs.designation_tie_all) {
      gs.designated_player_ids.forEach((id) => inc(s.designated!, id))
    }
  } else if (q.type === 'B') {
    s.rounds_b++
    if (gs.b_subtype === 'B1') {
      s.rounds_b1++
      // B1: every "oui" was shown on screen → safe to track.
      gs.revealed_player_ids.forEach((id) => inc(s.confessed!, id))
    } else if (gs.b_subtype === 'B2') {
      s.rounds_b2++
      // B2: only the roulette winner was revealed. The others stay anonymous.
      inc(s.confessed!, gs.designated_player_id)
    }
  } else if (q.type === 'C') {
    s.rounds_c++
    if (gs.phase === 'round_c_volunteers_reveal') {
      s.volunteers++
      // Volunteers raised their hand publicly.
      gs.volunteer_player_ids.forEach((id) => inc(s.volunteered!, id))
    } else if (gs.phase === 'round_c_roulette') {
      // Roulette winner was revealed on screen → same as Type A designation.
      inc(s.designated!, gs.designated_player_id)
    }
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
