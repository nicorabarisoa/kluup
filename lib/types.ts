export type Player = {
  id: string
  pseudo: string
  is_host: boolean
  room_id: string
  created_at?: string
}

export type Question = {
  id: string
  theme: string
  type: 'A' | 'B' | 'C'
  intensity: number
  question: { fr: string; en: string; es: string; de: string }
}

export type GamePhase =
  | 'voting_question'
  | 'round_a_vote'
  | 'round_a_reveal'
  | 'round_b_vote'
  | 'round_b2_roulette' // confession roulette — the only confession reveal now
  // Type C — single phase: each player either volunteers or sends someone.
  | 'round_c_choice'
  | 'round_c_volunteers_reveal' // ≥1 volunteer → they all answer
  | 'round_c_roulette'          // no volunteer → most-designated (roulette on tie) answers
  | 'ended'

export type BSubtype = 'B1' | 'B2'

export type SessionStats = {
  // Group counters
  rounds_a: number
  rounds_b: number
  rounds_b1: number
  rounds_b2: number
  rounds_c: number
  volunteers: number
  // Per-player public events (only what was revealed on screen — no anonymity breach).
  // Maps player_id → count. Optional for backward compat with pre-update games.
  designated?: Record<string, number>   // A: top designee(s) + C roulette winner
  confessed?: Record<string, number>    // B1: all "oui", B2: roulette winner only
  volunteered?: Record<string, number>  // C: players who raised their hand
}

export type GroupTitleKey =
  | 'title_ruthless'
  | 'title_transparent'
  | 'title_mysterious'
  | 'title_brave'
  | 'title_cautious'
  | 'title_nofilter'
  | 'title_accomplices'
  | 'title_daring'
  | 'title_unfathomable'
  | 'title_unclassifiable'

export type GameState = {
  phase: GamePhase
  round: number
  candidates: Question[]
  current_question: Question | null
  b_subtype: BSubtype | null
  // Single random pick — used by the B2 roulette only.
  designated_player_id: string | null
  // Designation result (Type A + Type C vote): the most-voted player(s).
  // length 1 = clear winner, >1 = tie among the leaders (all shown).
  designated_player_ids: string[]
  // True when every player is tied (nobody stood out) → "décevant" screen.
  designation_tie_all: boolean
  revealed_player_ids: string[]
  yes_percentage: number | null
  // Type C — everyone who volunteered (they all answer).
  volunteer_player_ids: string[]
  played_question_ids: string[]
  paused: boolean
  stats: SessionStats
  b2_revealed: boolean // host triggered the B2 roulette reveal
  // UUID v4 set by startGame() in the lobby on every game launch (including replay).
  // Used as session_id in user_session_stats (Phase 4). Never generated here — see makeInitialGameState.
  session_uuid: string
  // ISO timestamp set at each voting phase start by the caller (startGame/onNextRound/resolveVotes);
  // '' for non-voting phases. Clients derive remaining timer time from it after a refresh (D-07).
  round_started_at: string
  // Snapshot of players.length taken when the voting phase started; mid-round joiners are excluded
  // from the current round's threshold (D-09). 0 means 'use players.length fallback' for in-flight
  // games created before Phase 3.
  vote_round_player_count: number
}

export type Room = {
  id: string
  code: string
  // Lobby state is 'waiting' (DB default after schema.sql); 'lobby' is the legacy
  // default from the original migration and is treated identically. 'playing' once
  // started, 'ended' at the end.
  status: 'waiting' | 'lobby' | 'playing' | 'ended'
  theme: string
  game_state: GameState | null
}
