export type Player = {
  id: string
  pseudo: string
  is_host: boolean
  room_id: string
  is_online?: boolean
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
  | 'round_b1_reveal'
  | 'round_b2_roulette'
  | 'round_c_volunteer'
  | 'round_c_volunteer_reveal'
  | 'round_c_vote'
  | 'round_c_vote_reveal'
  | 'ended'

export type BSubtype = 'B1' | 'B2'

export type SessionStats = {
  rounds_a: number
  rounds_b: number
  rounds_b1: number
  rounds_b2: number
  rounds_c: number
  volunteers: number
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
  designated_player_id: string | null
  revealed_player_ids: string[]
  yes_percentage: number | null
  volunteer_player_id: string | null
  played_question_ids: string[]
  paused: boolean
  stats: SessionStats
  b2_revealed: boolean // host triggered the B2 roulette reveal
}

export type Room = {
  id: string
  code: string
  // 'waiting' is the DB default (lobby), then 'playing' once started, 'ended' at the end.
  status: 'waiting' | 'playing' | 'ended'
  theme: string
  game_state: GameState | null
}
