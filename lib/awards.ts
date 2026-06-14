/**
 * lib/awards.ts — Pure duo-awards engine for Kluup.
 *
 * No Supabase import. No React import. Data arrives as function arguments,
 * mirroring the lib/game.ts engine boundary.
 *
 * Exports:
 *   computeDuoAwards   — assigns up to 4 named duo awards from all room votes
 *   computePairMetrics — computes 5 per-pair metrics (exported for testing)
 *   DuoAward           — award result type
 *   PairMetrics        — 5-metric pair descriptor
 *   AWARD_DEFS         — canonical award definitions (key, emoji, score selector)
 *
 * Determinism (P-19): pairs are always built from players sorted by player.id
 * (localeCompare) before any computation. Every client derives the same Face 1
 * award assignments. No Math.random() is used for tie-breaking.
 *
 * Privacy (P-12): confession_overlap reads all players' confession vote answers.
 * Under the current open-RLS MVP posture, every client has access to these rows.
 * Raw answer values are scoped to computePairMetrics and never returned to
 * callers or rendered. This is a known MVP privacy gap — confession_overlap
 * should move to a server-side RPC (SECURITY DEFINER) before premium launch.
 */

import type { Player } from './types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Shape of a vote row as returned by Supabase (votes table).
 * Matches: { id, round, player_id, vote_type, target_player_id, answer }
 * `answer` is boolean (true = "oui"), NOT the string 'oui'.
 */
export interface VoteRow {
  id: string
  round: number
  player_id: string
  vote_type: 'designation' | 'confession' | 'volunteer' | 'question_selection' | string
  target_player_id: string | null
  answer: boolean | null
}

/**
 * Five per-round metrics computed for a unique player pair.
 * All metrics count the number of rounds in which the condition held
 * (a round contributes at most 1 to each metric).
 */
export interface PairMetrics {
  /** Rounds where A designated B AND B designated A (mutual designation). */
  mutual_designations: number
  /** Rounds where A and B both cast designation votes for the same third player C (C ≠ A, C ≠ B). */
  vote_alignment: number
  /** Rounds where exactly one of (A→B, B→A) designation exists — asymmetric. */
  opposition: number
  /**
   * Type B rounds where both A and B cast a confession vote with answer === true.
   *
   * PRIVACY NOTE (P-12 — known MVP gap): Under open RLS, clients can read all
   * confession vote rows including other players' `answer` fields. Raw answer
   * values are used only here and never exposed beyond this function.
   * This computation should move to a server-side RPC (SECURITY DEFINER) before
   * premium launch to enforce the anonymity boundary at the database level.
   */
  confession_overlap: number
  /** Type C rounds where both A and B have a vote_type='volunteer' vote. */
  co_volunteers: number
}

/** A named duo award assigned to a player pair. */
export interface DuoAward {
  awardKey: string
  emoji: string
  playerA: Player
  playerB: Player
  score: number
}

// ---------------------------------------------------------------------------
// AWARD_DEFS — canonical order (determines award assignment priority)
// ---------------------------------------------------------------------------

export const AWARD_DEFS: ReadonlyArray<{
  key: string
  emoji: string
  score: (m: PairMetrics) => number
}> = [
  { key: 'award_magnetisme',    emoji: '🧲', score: (m) => m.mutual_designations },
  { key: 'award_longueur_onde', emoji: '🧠', score: (m) => m.vote_alignment },
  { key: 'award_ennemis',       emoji: '⚔️', score: (m) => m.opposition },
  { key: 'award_complices',     emoji: '🔥', score: (m) => m.confession_overlap + m.co_volunteers },
]

// ---------------------------------------------------------------------------
// computePairMetrics
// ---------------------------------------------------------------------------

/**
 * Computes all 5 pair metrics for the pair (aId, bId) from a flat votes array.
 *
 * Votes are grouped by round first; each round contributes at most 1 to each
 * metric. This is consistent with the spec definition: metrics are per-round.
 *
 * @param allVotes  All vote rows for the room (flat array, all rounds).
 * @param aId       Player A's id.
 * @param bId       Player B's id.
 * @returns         PairMetrics with all 5 fields.
 */
export function computePairMetrics(
  allVotes: VoteRow[],
  aId: string,
  bId: string,
): PairMetrics {
  // Group votes by round for efficient per-round evaluation.
  const byRound = new Map<number, VoteRow[]>()
  for (const v of allVotes) {
    const bucket = byRound.get(v.round)
    if (bucket) {
      bucket.push(v)
    } else {
      byRound.set(v.round, [v])
    }
  }

  let mutual_designations = 0
  let vote_alignment = 0
  let opposition = 0
  let confession_overlap = 0
  let co_volunteers = 0

  for (const roundVotes of byRound.values()) {
    // --- Designation analysis ---
    // Flags for this round
    let aDesignatedB = false  // A cast a designation vote targeting B
    let bDesignatedA = false  // B cast a designation vote targeting A

    // Targets each player designated (for vote_alignment)
    let aTarget: string | null = null
    let bTarget: string | null = null

    // Confession flags (answer === true per player)
    // P-12: raw answer values scoped to this loop — never returned to callers.
    let aConfessed = false
    let bConfessed = false

    // Volunteer flags
    let aVolunteered = false
    let bVolunteered = false

    for (const v of roundVotes) {
      if (v.vote_type === 'designation') {
        if (v.player_id === aId && v.target_player_id === bId) {
          aDesignatedB = true
        }
        if (v.player_id === bId && v.target_player_id === aId) {
          bDesignatedA = true
        }
        // Track each player's designation target for vote_alignment
        if (v.player_id === aId && v.target_player_id !== null) {
          aTarget = v.target_player_id
        }
        if (v.player_id === bId && v.target_player_id !== null) {
          bTarget = v.target_player_id
        }
      } else if (v.vote_type === 'confession') {
        // P-12: answer === true check — raw boolean value stays local to this function.
        if (v.player_id === aId && v.answer === true) aConfessed = true
        if (v.player_id === bId && v.answer === true) bConfessed = true
      } else if (v.vote_type === 'volunteer') {
        if (v.player_id === aId) aVolunteered = true
        if (v.player_id === bId) bVolunteered = true
      }
    }

    // mutual_designations: both designated each other this round
    if (aDesignatedB && bDesignatedA) {
      mutual_designations += 1
    }

    // vote_alignment: both designated the same third player (not A or B)
    if (
      aTarget !== null &&
      bTarget !== null &&
      aTarget === bTarget &&
      aTarget !== aId &&
      aTarget !== bId
    ) {
      vote_alignment += 1
    }

    // opposition: exactly one of (A→B, B→A) exists — asymmetric
    if (aDesignatedB !== bDesignatedA) {
      opposition += 1
    }

    // confession_overlap: both confessed (answer=true) this round
    if (aConfessed && bConfessed) {
      confession_overlap += 1
    }

    // co_volunteers: both volunteered this round
    if (aVolunteered && bVolunteered) {
      co_volunteers += 1
    }
  }

  return {
    mutual_designations,
    vote_alignment,
    opposition,
    confession_overlap,
    co_volunteers,
  }
}

// ---------------------------------------------------------------------------
// computeDuoAwards
// ---------------------------------------------------------------------------

/**
 * Computes up to 4 named duo awards from all room votes.
 *
 * Algorithm:
 *   1. Sort players by player.id (localeCompare) — P-19 determinism guarantee.
 *      Every client derives the same Face 1 regardless of input array order.
 *   2. Build all unique pairs from the sorted player list.
 *   3. Compute PairMetrics for each pair.
 *   4. Walk AWARD_DEFS in canonical order. For each award:
 *      a. Filter pairs with score >= 2 (threshold).
 *      b. Sort by score desc, with variety tie-break: prefer a pair NOT already
 *         holding an award (awardedPairKeys.has(key) ? 1 : 0, lower is better).
 *      c. Assign the top candidate; mark its pair key as awarded.
 *   5. Return 0–4 awards.
 *
 * Note: An award is omitted when no pair meets the threshold (score < 2).
 * The caller (EndScreen) decides whether to render the DuoAwardsBlock based
 * on whether awards.length >= 2 (D-03).
 *
 * No Math.random() is used. V8 TimSort caches comparator results, so a random
 * comparator produces biased permutations — always use a deterministic key.
 * (See lib/game.ts lines 7–9 for the same rationale.)
 *
 * @param allVotes  All vote rows for the room (fetched by the caller).
 * @param players   All players in the room.
 * @returns         DuoAward[] with 0–4 items.
 */
export function computeDuoAwards(allVotes: VoteRow[], players: Player[]): DuoAward[] {
  if (players.length < 2) return []

  // P-19: Sort players by player.id (lexicographic localeCompare) BEFORE building pairs.
  // This guarantees every client derives the same pair order and the same Face 1 content.
  // Do NOT use a random comparator — see no-random-comparator comment above.
  const sorted = [...players].sort((a, b) => a.id.localeCompare(b.id))

  // Build all unique unordered pairs from the sorted player list.
  // Pair key: "${a.id}:${b.id}" where a comes before b in the sorted order.
  const pairs: [Player, Player][] = []
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      pairs.push([sorted[i], sorted[j]])
    }
  }

  // Compute metrics for every pair and store in a Map keyed by pair key.
  const metricsMap = new Map<string, PairMetrics>()
  for (const [a, b] of pairs) {
    const key = `${a.id}:${b.id}`
    metricsMap.set(key, computePairMetrics(allVotes, a.id, b.id))
  }

  // Walk AWARD_DEFS in canonical order, assigning at most one pair per award.
  const awards: DuoAward[] = []
  const awardedPairKeys = new Set<string>()

  for (const def of AWARD_DEFS) {
    const scored = pairs
      .map(([a, b]) => {
        const key = `${a.id}:${b.id}`
        const m = metricsMap.get(key)!
        return { a, b, key, score: def.score(m) }
      })
      .filter((c) => c.score >= 2)  // threshold: pairs below 2 are never awarded

    if (scored.length === 0) continue

    // Variety rule: prefer unawarded pairs over already-awarded pairs.
    // First, check if there are any unawarded qualifying pairs.
    const unawardedCandidates = scored.filter((c) => !awardedPairKeys.has(c.key))

    // If only already-awarded pairs qualify, omit this award (variety rule —
    // the award should introduce a new pair, not stack on one that already won).
    if (unawardedCandidates.length === 0) continue

    // Sort unawarded candidates by score descending; among ties the first in
    // sorted-player-id order wins (stable — pairs were built from localeCompare
    // order so iteration order is already deterministic).
    unawardedCandidates.sort((x, y) => y.score - x.score)

    // Also consider already-awarded pairs as lower-priority fallback — but only
    // when there are unawarded candidates we prefer them, so take the top unawarded.
    const winner = unawardedCandidates[0]

    awards.push({
      awardKey: def.key,
      emoji:    def.emoji,
      playerA:  winner.a,
      playerB:  winner.b,
      score:    winner.score,
    })
    awardedPairKeys.add(winner.key)
  }

  return awards
}
