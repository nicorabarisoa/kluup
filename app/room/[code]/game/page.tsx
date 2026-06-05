'use client'

import { forwardRef, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  accumulateStats,
  computeGroupTitle,
  countVotes,
  fetchVotes,
  pickBSubtype,
  pickCandidates,
  tallyDesignation,
  tallyQuestionSelection,
  updateRoomGameState,
} from '@/lib/game'
import { useT, useLocale } from '@/lib/locale'
import type { Dict } from '@/lib/i18n'
import { GameState, Player, Room } from '@/lib/types'

// ---------------------------------------------------------------------------
// Design tokens
// ---------------------------------------------------------------------------

const C = {
  bg: '#0D0D0D',
  surface: '#1A1A1A',
  border: '#252525',
  text: '#FFFFFF',
  muted: '#888888',
  faint: '#555555',
  a: '#FF3C6F',
  b: '#7B2FFF',
  c: '#FFD600',
}

const MAX_ROUNDS = 7

const THEME_META: Record<string, { name: string; color: string }> = {
  'hello-stranger': { name: 'Hello Stranger', color: '#00C896' },
  'apero': { name: 'Apéro', color: '#FFB800' },
  'no-filter': { name: 'No Filter', color: '#FF3C6F' },
  'unmasked': { name: 'Unmasked', color: '#7B2FFF' },
}

const AVATAR_COLORS = [C.a, C.b, C.c, '#00C896']

function accentForType(type?: 'A' | 'B' | 'C'): string {
  if (type === 'A') return C.a
  if (type === 'B') return C.b
  if (type === 'C') return C.c
  return C.a
}

function avatarColor(index: number) {
  return AVATAR_COLORS[index % AVATAR_COLORS.length]
}

function playerInitial(pseudo: string) {
  return pseudo.charAt(0).toUpperCase()
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

function GameScreen({
  header,
  children,
  footer,
}: {
  header?: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  return (
    <div style={{ minHeight: '100svh', background: C.bg, display: 'flex', flexDirection: 'column', color: C.text }}>
      {header && (
        <div style={{ padding: '16px 20px 0', flexShrink: 0 }}>{header}</div>
      )}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {children}
      </div>
      {footer && (
        <div style={{ padding: '12px 20px 32px', flexShrink: 0 }}>{footer}</div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

function TypeBadge({ label, accent }: { label: string; accent: string }) {
  return (
    <span
      className="text-xs font-bold px-3 py-1 rounded-full"
      style={{ background: `${accent}22`, color: accent, fontFamily: 'var(--font-body)' }}
    >
      {label}
    </span>
  )
}

function RoundHeader({ round, label, accent }: { round: number; label: string; accent: string }) {
  return (
    <div className="mb-4">
      {/* Colored bar signals the round type */}
      <div className="h-1 w-full rounded-full mb-3" style={{ background: accent }} />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ background: accent }}
          />
          <span
            className="font-extrabold uppercase"
            style={{ color: accent, fontSize: 16, letterSpacing: '0.04em', fontFamily: 'var(--font-display)' }}
          >
            {label}
          </span>
        </div>
        <span style={{ color: C.muted, fontSize: 12, fontFamily: 'var(--font-body)' }}>
          Round {round} / {MAX_ROUNDS}
        </span>
      </div>
    </div>
  )
}

function QuestionCard({ text, accent }: { text: string; accent: string }) {
  return (
    <div
      className="w-full rounded-3xl p-6 text-center my-6"
      style={{ background: C.surface, border: `1px solid ${accent}44` }}
    >
      <p
        className="text-2xl leading-snug"
        style={{ fontFamily: 'var(--font-display)', color: C.text }}
      >
        {text}
      </p>
    </div>
  )
}

function PlayerAvatar({ pseudo, index, size = 48 }: { pseudo: string; index: number; size?: number }) {
  const color = avatarColor(index)
  return (
    <div
      className="rounded-full flex items-center justify-center font-bold flex-shrink-0"
      style={{
        width: size, height: size,
        background: `${color}33`,
        border: `2px solid ${color}`,
        color,
        fontSize: size * 0.4,
        fontFamily: 'var(--font-display)',
      }}
    >
      {playerInitial(pseudo)}
    </div>
  )
}

function PrimaryBtn({
  onClick, disabled, children, accent, textDark = false,
}: {
  onClick?: () => void
  disabled?: boolean
  children: React.ReactNode
  accent: string
  textDark?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full font-bold py-4 rounded-2xl text-base disabled:opacity-40"
      style={{
        background: accent,
        color: textDark ? '#0D0D0D' : '#fff',
        fontFamily: 'var(--font-body)',
      }}
    >
      {children}
    </button>
  )
}

function SecondaryBtn({ onClick, disabled, children }: { onClick?: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full font-medium py-4 rounded-2xl text-base disabled:opacity-40"
      style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.text, fontFamily: 'var(--font-body)' }}
    >
      {children}
    </button>
  )
}

function GhostBtn({ onClick, children }: { onClick?: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="w-full py-3 text-sm font-medium"
      style={{ color: C.muted, fontFamily: 'var(--font-body)' }}
    >
      {children}
    </button>
  )
}

// Vote progress visible to everyone during a vote (voters and non-voters alike).
function VoteProgress({ count, total, voted }: { count: number; total: number; voted: boolean }) {
  const fr = useT()
  // A voter has cast at least their own vote, so never show less than 1 for them.
  const shown = voted ? Math.max(count, 1) : count
  return (
    <div className="text-center mt-4">
      {voted && (
        <p className="text-sm font-medium" style={{ color: '#4ADE80' }}>
          {fr.game.vote_sent}
        </p>
      )}
      <p className="text-xs mt-1" style={{ color: C.muted }}>
        {fr.game.waiting_for_votes(shown, total)}
      </p>
    </div>
  )
}

// Host-only escape hatch on vote phases: resolve with the votes cast so far so
// a disconnected/AFK player can't freeze the game waiting for a vote that never comes.
function HostSkipBtn({ show, onForce }: { show: boolean; onForce: () => void }) {
  const fr = useT()
  if (!show) return null
  return (
    <button
      onClick={onForce}
      className="w-full py-3 text-xs font-medium mt-2"
      style={{ color: C.muted, fontFamily: 'var(--font-body)' }}
    >
      {fr.game.skip_wait}
    </button>
  )
}

function WaitingDots() {
  return (
    <div className="flex gap-1 justify-center mt-6">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="w-2 h-2 rounded-full animate-bounce"
          style={{ background: C.muted, animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  )
}

function PauseBtn({ onPause }: { onPause: () => void }) {
  return (
    <button
      onClick={onPause}
      className="fixed top-4 right-4 z-50 w-10 h-10 rounded-full flex items-center justify-center"
      style={{ background: C.surface, border: `1px solid ${C.border}` }}
      aria-label="Pause"
    >
      ⏸
    </button>
  )
}

// Lets a non-host player leave; the game continues for everyone else.
function QuitBtn({ onQuit }: { onQuit: () => void }) {
  const fr = useT()
  return (
    <button
      onClick={onQuit}
      className="fixed top-4 left-4 z-50 px-3 h-10 rounded-full flex items-center justify-center text-xs font-medium"
      style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.muted, fontFamily: 'var(--font-body)' }}
      aria-label={fr.game.quit}
    >
      {fr.game.quit}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Screens
// ---------------------------------------------------------------------------

function LoadingScreen() {
  return (
    <GameScreen>
      <div className="flex-1 flex items-center justify-center">
        <WaitingDots />
      </div>
    </GameScreen>
  )
}

function PausedScreen({ isHost, onResume, onStop }: { isHost: boolean; onResume: () => void; onStop: () => void }) {
  const fr = useT()
  return (
    <GameScreen
      footer={isHost ? (
        <div className="flex flex-col gap-2">
          <PrimaryBtn onClick={onResume} accent={C.a}>{fr.game.resume}</PrimaryBtn>
          <GhostBtn onClick={onStop}>{fr.game.stop_game}</GhostBtn>
        </div>
      ) : undefined}
    >
      <div className="flex-1 flex flex-col items-center justify-center text-center gap-3">
        <p className="text-4xl">⏸</p>
        <h2 className="text-2xl font-extrabold" style={{ fontFamily: 'var(--font-display)' }}>
          {fr.game.paused_title}
        </h2>
        <p style={{ color: C.muted }}>{fr.game.paused_body}</p>
      </div>
    </GameScreen>
  )
}

// ---- Question selection ----

function QuestionSelectionScreen({
  gs, isHost, hasVoted, voteCount, playerCount, onVote, onForce,
}: {
  gs: GameState; isHost: boolean; hasVoted: boolean; voteCount: number; playerCount: number; onVote: (i: number) => void; onForce: () => void
}) {
  const fr = useT()
  const { locale } = useLocale()
  // A round has a single type — read it once from the candidates.
  const roundType = gs.candidates[0]?.type
  const accent = accentForType(roundType)
  const typeLabel = roundType === 'A' ? fr.designation.label : roundType === 'B' ? fr.confession.label : fr.question_ouverte.label

  return (
    <GameScreen header={<RoundHeader round={gs.round} label={typeLabel} accent={accent} />}>
      <div className="w-full max-w-sm pt-4">
        <p style={{ color: C.muted, fontSize: 13, fontFamily: 'var(--font-body)', textAlign: 'center' }}>
          {fr.voting_question.instruction}
        </p>
        <h1
          className="text-2xl font-extrabold text-center mt-1 mb-6"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {fr.voting_question.title}
        </h1>

        <div className="flex flex-col gap-3">
          {gs.candidates.map((q, i) => (
            <button
              key={q.id}
              onClick={() => !hasVoted && onVote(i)}
              disabled={hasVoted}
              className="rounded-2xl p-4 text-left transition-all disabled:opacity-60"
              style={{ background: C.surface, border: `1px solid ${hasVoted ? C.border : accent + '44'}` }}
            >
              <p className="text-sm leading-snug" style={{ color: C.text, fontFamily: 'var(--font-body)' }}>
                {q.question[locale]}
              </p>
            </button>
          ))}
        </div>

        <VoteProgress count={voteCount} total={playerCount} voted={hasVoted} />
        <HostSkipBtn show={isHost && hasVoted && voteCount < playerCount} onForce={onForce} />
      </div>
    </GameScreen>
  )
}

// ---- Designation vote (Type A + Type C vote) ----

function DesignationVoteScreen({
  gs, players, myId, isHost, hasVoted, voteCount, accent, onVote, onForce,
}: {
  gs: GameState; players: Player[]; myId: string | null; isHost: boolean; hasVoted: boolean; voteCount: number; accent: string; onVote: (id: string) => void; onForce: () => void
}) {
  const fr = useT()
  const { locale } = useLocale()
  const q = gs.current_question!
  const isTypeC = q.type === 'C'
  const label = isTypeC ? fr.question_ouverte.label : fr.designation.label
  const instruction = isTypeC ? fr.question_ouverte.vote_instruction : fr.designation.instruction
  // Everyone is votable — including yourself (you can own a "le plus susceptible de…").
  // This also lets a 2-player group break out of the forced full-tie.

  return (
    <GameScreen
      header={<RoundHeader round={gs.round} label={label} accent={accent} />}
      footer={
        <>
          <VoteProgress count={voteCount} total={players.length} voted={hasVoted} />
          <HostSkipBtn show={isHost && hasVoted && voteCount < players.length} onForce={onForce} />
        </>
      }
    >
      <div className="w-full max-w-sm">
        <QuestionCard text={q.question[locale]} accent={accent} />

        {hasVoted ? (
          <WaitingDots />
        ) : (
          <>
            <p className="text-sm text-center mb-4" style={{ color: C.muted, fontFamily: 'var(--font-body)' }}>
              {instruction}
            </p>
            <div className="flex flex-col gap-3">
              {players.map((p) => (
                <button
                  key={p.id}
                  onClick={() => onVote(p.id)}
                  className="flex items-center gap-3 rounded-2xl p-4"
                  style={{ background: C.surface, border: `1px solid ${C.border}` }}
                >
                  <PlayerAvatar pseudo={p.pseudo} index={players.indexOf(p)} size={40} />
                  <span className="font-medium" style={{ fontFamily: 'var(--font-body)', color: C.text }}>
                    {p.pseudo}
                    {p.id === myId && (
                      <span className="ml-2 text-xs" style={{ color: C.faint }}>({fr.common.you})</span>
                    )}
                  </span>
                </button>
              ))}
            </div>
            <p className="text-center text-xs mt-4" style={{ color: C.faint, fontFamily: 'var(--font-body)' }}>
              {fr.common.vote_anonymous}
            </p>
          </>
        )}
      </div>
    </GameScreen>
  )
}

// ---- Designation reveal (Type A + Type C vote) ----

function DesignationRevealScreen({
  gs, players, isHost, accent, nextLabel, onNext, onEnd,
}: {
  gs: GameState; players: Player[]; isHost: boolean; accent: string; nextLabel: string; onNext: () => void; onEnd: () => void
}) {
  const fr = useT()
  const { locale } = useLocale()
  const q = gs.current_question!
  const isTypeC = q.type === 'C'
  const label = isTypeC ? fr.question_ouverte.label : fr.designation.label

  const top = gs.designated_player_ids
    .map((id) => players.find((p) => p.id === id))
    .filter((p): p is Player => !!p)
  const tieAll = gs.designation_tie_all
  const multiple = top.length > 1

  // Short suspense before the result appears.
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setShown(true), 1800)
    return () => clearTimeout(t)
  }, [])

  return (
    <GameScreen
      header={<RoundHeader round={gs.round} label={label} accent={accent} />}
      footer={
        shown && isHost ? (
          <div className="flex flex-col gap-2">
            <PrimaryBtn onClick={onNext} accent={accent} textDark={q.type === 'C'}>
              {nextLabel}
            </PrimaryBtn>
            <GhostBtn onClick={onEnd}>{fr.game.end_game}</GhostBtn>
          </div>
        ) : (
          <WaitingDots />
        )
      }
    >
      <div className="w-full max-w-sm flex flex-col items-center">
        {/* Redisplay the question so everyone remembers the topic while answering. */}
        <QuestionCard text={q.question[locale]} accent={accent} />

        {!shown ? (
          <div className="flex flex-col items-center pt-2">
            <p
              className="text-2xl font-extrabold text-center"
              style={{ fontFamily: 'var(--font-display)', color: accent }}
            >
              {fr.designation.result_title}
            </p>
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-extrabold mt-6"
              style={{
                background: `${accent}22`, border: `3px solid ${accent}`,
                fontFamily: 'var(--font-display)', color: accent,
                animation: 'b2pulse 0.9s ease-in-out infinite',
              }}
            >
              ?
            </div>
          </div>
        ) : tieAll ? (
          // Full tie — nobody stood out.
          <div className="flex flex-col items-center pt-2 text-center" style={{ animation: 'b2pop 0.4s ease-out' }}>
            <p className="text-5xl mb-3">😈</p>
            <h2 className="text-3xl font-extrabold mb-2" style={{ fontFamily: 'var(--font-display)', color: accent }}>
              {fr.designation.tie_all_title}
            </h2>
            <p style={{ color: C.muted, fontFamily: 'var(--font-body)', fontSize: 14 }}>
              {fr.designation.tie_all_body}
            </p>
          </div>
        ) : multiple ? (
          // Tie among the leaders — show them all.
          <div className="flex flex-col items-center pt-2" style={{ animation: 'b2pop 0.4s ease-out' }}>
            <h2 className="text-2xl font-extrabold mb-4 text-center" style={{ fontFamily: 'var(--font-display)', color: accent }}>
              {fr.designation.tie_some_title(top.length)}
            </h2>
            <div className="flex flex-wrap justify-center gap-4">
              {top.map((p) => (
                <div key={p.id} className="flex flex-col items-center gap-1">
                  <PlayerAvatar pseudo={p.pseudo} index={players.indexOf(p)} size={64} />
                  <span className="text-sm font-medium" style={{ fontFamily: 'var(--font-body)' }}>{p.pseudo}</span>
                </div>
              ))}
            </div>
            <p className="mt-4 text-center" style={{ color: C.muted, fontFamily: 'var(--font-body)', fontSize: 14 }}>
              {fr.designation.tie_some_body}
            </p>
          </div>
        ) : top.length === 1 ? (
          // Single clear winner.
          <div className="flex flex-col items-center pt-2" style={{ animation: 'b2pop 0.4s ease-out' }}>
            <PlayerAvatar pseudo={top[0].pseudo} index={players.indexOf(top[0])} size={80} />
            <h2 className="text-3xl font-extrabold mt-4 mb-2 text-center" style={{ fontFamily: 'var(--font-display)' }}>
              {top[0].pseudo}
            </h2>
            <p style={{ color: C.muted, fontFamily: 'var(--font-body)', fontSize: 14 }}>
              {fr.designation.reveal_body(top[0].pseudo)}
            </p>
          </div>
        ) : (
          // Designated player(s) are no longer in the room (left mid-game).
          <p className="pt-2 text-center" style={{ color: C.muted, fontFamily: 'var(--font-body)' }}>
            {fr.designation.result_title}
          </p>
        )}
      </div>
    </GameScreen>
  )
}

// ---- Confession vote (Type B) ----

function ConfessionVoteScreen({
  gs, players, isHost, hasVoted, voteCount, onVote, onForce,
}: {
  gs: GameState; players: Player[]; isHost: boolean; hasVoted: boolean; voteCount: number; onVote: (a: boolean) => void; onForce: () => void
}) {
  const fr = useT()
  const { locale } = useLocale()
  const q = gs.current_question!

  return (
    <GameScreen
      header={<RoundHeader round={gs.round} label={fr.confession.label} accent={C.b} />}
      footer={
        hasVoted ? undefined : (
          <div className="flex gap-3">
            <button
              onClick={() => onVote(true)}
              className="flex-1 rounded-2xl py-5 font-bold text-lg"
              style={{ background: C.b, color: '#fff', fontFamily: 'var(--font-body)' }}
            >
              <span className="block">{fr.confession.yes}</span>
              <span className="block text-xs font-normal mt-0.5 opacity-70">{fr.confession.yes_sub}</span>
            </button>
            <button
              onClick={() => onVote(false)}
              className="flex-1 rounded-2xl py-5 font-bold text-lg"
              style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.text, fontFamily: 'var(--font-body)' }}
            >
              <span className="block">{fr.confession.no}</span>
              <span className="block text-xs font-normal mt-0.5 opacity-70">{fr.confession.no_sub}</span>
            </button>
          </div>
        )
      }
    >
      <div className="w-full max-w-sm">
        <QuestionCard text={q.question[locale]} accent={C.b} />
        {hasVoted ? (
          <WaitingDots />
        ) : (
          <p className="text-center text-xs" style={{ color: C.faint, fontFamily: 'var(--font-body)' }}>
            {fr.confession.answer_private}
          </p>
        )}
        <VoteProgress count={voteCount} total={players.length} voted={hasVoted} />
        <HostSkipBtn show={isHost && hasVoted && voteCount < players.length} onForce={onForce} />
      </div>
    </GameScreen>
  )
}

// ---- B1 reveal ----

function B1RevealScreen({
  gs, players, isHost, nextLabel, onNext, onEnd,
}: {
  gs: GameState; players: Player[]; isHost: boolean; nextLabel: string; onNext: () => void; onEnd: () => void
}) {
  const fr = useT()
  const yesCount = gs.revealed_player_ids.length
  const total = players.length
  const pct = gs.yes_percentage ?? 0
  const nobody = yesCount === 0
  const all = yesCount === total

  return (
    <GameScreen
      header={<RoundHeader round={gs.round} label={fr.confession.label} accent={C.b} />}
      footer={
        isHost ? (
          <div className="flex flex-col gap-2">
            <PrimaryBtn onClick={onNext} accent={C.b}>{nextLabel}</PrimaryBtn>
            <GhostBtn onClick={onEnd}>{fr.game.end_game}</GhostBtn>
          </div>
        ) : (
          <WaitingDots />
        )
      }
    >
      <div className="w-full max-w-sm flex flex-col items-center pt-10">
        <h2
          className="text-sm font-bold mb-6"
          style={{ color: C.muted, fontFamily: 'var(--font-body)' }}
        >
          {fr.confession.b1_title}
        </h2>

        {nobody ? (
          <p className="text-center" style={{ color: C.muted, fontFamily: 'var(--font-body)' }}>
            {fr.confession.b1_nobody}
          </p>
        ) : (
          <>
            <p
              className="font-extrabold"
              style={{ color: C.b, fontSize: 72, lineHeight: 1, fontFamily: 'var(--font-display)' }}
            >
              {pct}%
            </p>
            <p className="mt-2 text-center" style={{ color: C.text, fontFamily: 'var(--font-body)' }}>
              {all ? fr.confession.b1_all : fr.confession.b1_count(yesCount, total)}
            </p>
            {/* B1 = révélation totale — tous les "oui" affichés */}
            <div className="mt-6 flex flex-wrap justify-center gap-4">
              {gs.revealed_player_ids.map((id) => {
                const p = players.find((pl) => pl.id === id)
                if (!p) return null
                return (
                  <div key={id} className="flex flex-col items-center gap-1">
                    <PlayerAvatar pseudo={p.pseudo} index={players.indexOf(p)} size={48} />
                    <span className="text-xs" style={{ color: C.muted, fontFamily: 'var(--font-body)' }}>
                      {p.pseudo}
                    </span>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </GameScreen>
  )
}

// ---- B2 roulette ----

function B2RouletteScreen({
  gs, players, isHost, nextLabel, onReveal, onNext, onEnd,
}: {
  gs: GameState; players: Player[]; isHost: boolean; nextLabel: string; onReveal: () => void; onNext: () => void; onEnd: () => void
}) {
  const fr = useT()
  const designated = players.find((p) => p.id === gs.designated_player_id)
  const name = designated?.pseudo ?? '?'
  const idx = designated ? players.indexOf(designated) : 0
  const pct = gs.yes_percentage ?? 0
  const yesCount = gs.revealed_player_ids?.length ?? 0
  const nobody = !gs.designated_player_id || yesCount === 0
  // Everyone who said yes except the one the roulette picked stays anonymous.
  const othersCount = Math.max(0, yesCount - 1)

  // The roulette spins on every client when the host triggers gs.b2_revealed.
  const [spinIndex, setSpinIndex] = useState(0)
  const [done, setDone] = useState(false)

  const [tick, setTick] = useState(0) // drives the per-change pulse

  useEffect(() => {
    if (!gs.b2_revealed || nobody || players.length === 0) return
    const targetIdx = Math.max(0, players.findIndex((p) => p.id === gs.designated_player_id))
    let current = 0
    let ticks = 0
    let delay = 55 // fast start
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>

    const minTicks = players.length * 6 // several full loops before slowing
    const step = () => {
      if (cancelled) return
      current = (current + 1) % players.length
      setSpinIndex(current)
      setTick((t) => t + 1)
      ticks++
      // Decelerate progressively once we've spun enough.
      if (ticks > minTicks) delay += 30
      // Stop only when slow AND landed on the target.
      if (ticks > minTicks && current === targetIdx && delay > 300) {
        setDone(true)
        return
      }
      timer = setTimeout(step, delay)
    }
    timer = setTimeout(step, delay)
    return () => { cancelled = true; clearTimeout(timer) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gs.b2_revealed])

  const spinning = gs.b2_revealed && !done && !nobody
  const spinPlayer = players[spinIndex]

  return (
    <GameScreen
      header={<RoundHeader round={gs.round} label={fr.confession.label} accent={C.b} />}
      footer={
        nobody && isHost ? (
          <PrimaryBtn onClick={onNext} accent={C.b}>{nextLabel}</PrimaryBtn>
        ) : done && isHost ? (
          <div className="flex flex-col gap-2">
            <PrimaryBtn onClick={onNext} accent={C.b}>{nextLabel}</PrimaryBtn>
            <GhostBtn onClick={onEnd}>{fr.game.end_game}</GhostBtn>
          </div>
        ) : !gs.b2_revealed && isHost && !nobody ? (
          <PrimaryBtn onClick={onReveal} accent={C.b}>{fr.confession.b2_btn_reveal}</PrimaryBtn>
        ) : (
          <WaitingDots />
        )
      }
    >
      <div className="w-full max-w-sm flex flex-col items-center pt-8">
        <p className="text-center mb-6 text-sm" style={{ color: C.muted, fontFamily: 'var(--font-body)' }}>
          {fr.confession.b2_percent(pct)}
        </p>

        {nobody ? (
          <p className="text-center mt-4" style={{ color: C.muted, fontFamily: 'var(--font-body)' }}>
            {fr.confession.b2_nobody}
          </p>
        ) : !gs.b2_revealed ? (
          // Idle mystery circle, waiting for the host to reveal.
          <div
            className="w-32 h-32 rounded-full flex items-center justify-center text-4xl font-extrabold"
            style={{
              background: `${C.b}22`, border: `3px solid ${C.b}`,
              boxShadow: `0 0 40px ${C.b}44`, fontFamily: 'var(--font-display)', color: C.b,
            }}
          >
            ?
          </div>
        ) : spinning ? (
          // Roulette: cycle through players in a circle, with the pseudo below.
          <div className="flex flex-col items-center">
            <div
              key={tick} /* re-mount each change to retrigger the pop */
              className="rounded-full flex items-center justify-center font-extrabold"
              style={{
                width: 96, height: 96,
                background: `${(spinPlayer ? avatarColor(spinIndex) : C.b)}33`,
                border: `3px solid ${spinPlayer ? avatarColor(spinIndex) : C.b}`,
                boxShadow: `0 0 45px ${C.b}55`,
                color: spinPlayer ? avatarColor(spinIndex) : C.b,
                fontSize: 38, fontFamily: 'var(--font-display)',
                animation: 'b2flick 90ms ease-out',
              }}
            >
              {spinPlayer ? playerInitial(spinPlayer.pseudo) : '?'}
            </div>
            <h2
              key={`name-${tick}`}
              className="text-3xl font-extrabold mt-4 mb-2 text-center"
              style={{ fontFamily: 'var(--font-display)', color: '#fff', animation: 'b2flick 90ms ease-out' }}
            >
              {spinPlayer ? spinPlayer.pseudo : '?'}
            </h2>
            <p style={{ color: C.muted, fontFamily: 'var(--font-body)', fontSize: 14 }}>
              {fr.confession.b2_spinning}
            </p>
          </div>
        ) : (
          // Final reveal — the designated person, with a pop animation.
          <div className="flex flex-col items-center" style={{ animation: 'b2pop 0.4s ease-out' }}>
            <PlayerAvatar pseudo={name} index={idx} size={96} />
            <h2
              className="text-3xl font-extrabold mt-4 mb-2 text-center"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {name}
            </h2>
            <p style={{ color: C.muted, fontFamily: 'var(--font-body)', fontSize: 14, textAlign: 'center' }}>
              {fr.confession.b2_reveal(name)}
            </p>
            {othersCount > 0 && (
              <p className="mt-3 text-sm" style={{ color: C.faint, fontFamily: 'var(--font-body)' }}>
                {fr.confession.b2_others(othersCount)}
              </p>
            )}
          </div>
        )}
      </div>
    </GameScreen>
  )
}

// ---- Volunteer screen (Type C) ----

function VolunteerScreen({
  gs, myId, isHost, onVolunteer, onSkip,
}: {
  gs: GameState; myId: string | null; isHost: boolean; onVolunteer: () => void; onSkip: () => void
}) {
  const fr = useT()
  const { locale } = useLocale()
  const q = gs.current_question!
  const [volunteered, setVolunteered] = useState(false)

  return (
    <GameScreen
      header={<RoundHeader round={gs.round} label={fr.question_ouverte.label} accent={C.c} />}
      footer={
        volunteered ? undefined : (
          <div className="flex flex-col gap-2">
            <PrimaryBtn
              onClick={() => { setVolunteered(true); onVolunteer() }}
              accent={C.c}
              textDark
            >
              {fr.question_ouverte.volunteer_btn}
            </PrimaryBtn>
            {isHost && (
              <GhostBtn onClick={onSkip}>{fr.question_ouverte.volunteer_host_skip}</GhostBtn>
            )}
          </div>
        )
      }
    >
      <div className="w-full max-w-sm">
        <QuestionCard text={q.question[locale]} accent={C.c} />
        <div className="text-center">
          <p className="font-bold mb-1" style={{ fontFamily: 'var(--font-display)', fontSize: 18 }}>
            {fr.question_ouverte.volunteer_title}
          </p>
          <p style={{ color: C.muted, fontSize: 14, fontFamily: 'var(--font-body)' }}>
            {fr.question_ouverte.volunteer_body}
          </p>
          {volunteered && <WaitingDots />}
        </div>
      </div>
    </GameScreen>
  )
}

// ---- Volunteer revealed ----

function VolunteerRevealScreen({
  gs, players, isHost, nextLabel, onNext, onEnd,
}: {
  gs: GameState; players: Player[]; isHost: boolean; nextLabel: string; onNext: () => void; onEnd: () => void
}) {
  const fr = useT()
  const { locale } = useLocale()
  const q = gs.current_question!
  const volunteer = players.find((p) => p.id === gs.volunteer_player_id)
  const name = volunteer?.pseudo ?? '?'
  const idx = volunteer ? players.indexOf(volunteer) : 0

  // Short build-up before the volunteer pops in.
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setShown(true), 1200)
    return () => clearTimeout(t)
  }, [])

  return (
    <GameScreen
      header={<RoundHeader round={gs.round} label={fr.question_ouverte.label} accent={C.c} />}
      footer={
        shown && isHost ? (
          <div className="flex flex-col gap-2">
            <PrimaryBtn onClick={onNext} accent={C.c} textDark>{nextLabel}</PrimaryBtn>
            <GhostBtn onClick={onEnd}>{fr.game.end_game}</GhostBtn>
          </div>
        ) : (
          <WaitingDots />
        )
      }
    >
      <div className="w-full max-w-sm flex flex-col items-center">
        {/* Redisplay the question so everyone remembers the topic while answering. */}
        <QuestionCard text={q.question[locale]} accent={C.c} />
        {!shown ? (
          <p className="text-5xl pt-2" style={{ animation: 'b2pulse 0.7s ease-in-out infinite' }}>🙋</p>
        ) : (
          <div className="flex flex-col items-center" style={{ animation: 'b2pop 0.4s ease-out' }}>
            <PlayerAvatar pseudo={name} index={idx} size={80} />
            <h2
              className="text-3xl font-extrabold mt-4 mb-1 text-center"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {name}
            </h2>
            <p style={{ color: C.c, fontFamily: 'var(--font-body)', fontSize: 14 }}>
              {fr.question_ouverte.volunteer_reveal(name)}
            </p>
          </div>
        )}
      </div>
    </GameScreen>
  )
}

// ---- Share card ----

// The "moment fort" stat shown on the card, tailored to the group title.
function momentStat(titleKey: string, stats: GameState['stats'], totalRounds: number, t: Dict): string {
  const s = stats
  switch (titleKey) {
    case 'title_ruthless':
    case 'title_nofilter':
      return t.card.stat.designations(s.rounds_a)
    case 'title_transparent':
    case 'title_daring':
      return t.card.stat.confessions_open(s.rounds_b1)
    case 'title_mysterious':
    case 'title_unfathomable':
      return t.card.stat.roulette(s.rounds_b2)
    case 'title_brave':
      return t.card.stat.volunteers(s.volunteers)
    case 'title_cautious':
      return t.card.stat.open_questions(s.rounds_c)
    case 'title_accomplices':
      return t.card.stat.rounds(totalRounds)
    default:
      return t.card.stat.mix(s.rounds_a, s.rounds_b, s.rounds_c)
  }
}

// Square share card (rendered to PNG via html2canvas).
const ShareCard = forwardRef<HTMLDivElement, {
  theme: string
  titleName: string
  statText: string
  players: Player[]
}>(function ShareCard({ theme, titleName, statText, players }, ref) {
  const fr = useT()
  const meta = THEME_META[theme] ?? { name: theme, color: C.a }

  return (
    <div
      ref={ref}
      style={{
        width: 540, height: 540, background: C.bg, position: 'relative',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        fontFamily: 'var(--font-body)',
      }}
    >
      {/* Top color bar */}
      <div style={{ height: 6, background: meta.color, width: '100%' }} />

      <div style={{ padding: '32px 36px', display: 'flex', flexDirection: 'column', flex: 1 }}>
        {/* Theme + logo */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: meta.color, fontSize: 16, fontWeight: 700 }}>{meta.name}</span>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, color: '#fff' }}>
            Klu<span style={{ color: C.a }}>up</span>
          </span>
        </div>

        {/* Group title */}
        <div style={{ marginTop: 40 }}>
          <p style={{ color: C.muted, fontSize: 14, margin: 0 }}>Ce soir vous étiez…</p>
          <h1 style={{
            fontFamily: 'var(--font-display)', fontWeight: 800, color: '#fff',
            fontSize: 52, lineHeight: 1.05, margin: '8px 0 0',
          }}>
            {titleName}
          </h1>
        </div>

        {/* Moment fort */}
        <div style={{
          marginTop: 28, background: C.surface, borderRadius: 20, padding: '20px 22px',
          borderLeft: `4px solid ${meta.color}`,
        }}>
          <p style={{ color: C.muted, fontSize: 12, margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {fr.card.moment}
          </p>
          <p style={{ color: '#fff', fontSize: 18, fontWeight: 500, margin: '6px 0 0' }}>
            {statText}
          </p>
        </div>

        {/* Players pills */}
        <div style={{ marginTop: 'auto', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {players.map((p, i) => {
            const color = avatarColor(i)
            return (
              <span key={p.id} style={{
                background: C.surface, border: `1px solid ${C.border}`,
                color: '#fff', fontSize: 14, fontWeight: 500,
                borderRadius: 999, padding: '6px 14px',
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: color, display: 'inline-block' }} />
                {p.pseudo}
              </span>
            )
          })}
        </div>

        <p style={{ color: C.faint, fontSize: 13, marginTop: 20, marginBottom: 0, textAlign: 'center' }}>
          {fr.card.footer}
        </p>
      </div>
    </div>
  )
})

// ---- End screen ----

function EndScreen({
  gs, players, isHost, theme, onNewRound, onLeave,
}: {
  gs: GameState; players: Player[]; isHost: boolean; theme: string; onNewRound: () => void; onLeave: () => void
}) {
  const fr = useT()
  // Derive from the accumulated stats so the count and the title percentages
  // share the same denominator (every completed round lands in exactly one of these).
  const totalRounds = gs.stats.rounds_a + gs.stats.rounds_b + gs.stats.rounds_c
  const titleKey = computeGroupTitle(gs.stats, theme, totalRounds)
  const title = fr.titles[titleKey]
  const statText = momentStat(titleKey, gs.stats, totalRounds, fr)

  const [showCard, setShowCard] = useState(false)
  const [exporting, setExporting] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  async function exportCard() {
    if (!cardRef.current) return
    setExporting(true)
    try {
      const html2canvas = (await import('html2canvas')).default
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: C.bg,
        scale: 2, // 540 * 2 = 1080px
      })
      const dataUrl = canvas.toDataURL('image/png')
      const link = document.createElement('a')
      link.href = dataUrl
      link.download = `kluup-${title.name.toLowerCase().replace(/\s+/g, '-')}.png`
      link.click()
    } catch (e) {
      console.error('[card export]', e)
    } finally {
      setExporting(false)
    }
  }

  return (
    <GameScreen
      footer={
        <div className="flex flex-col gap-2">
          <PrimaryBtn onClick={() => setShowCard(true)} accent={C.a}>{fr.end.share_cta}</PrimaryBtn>
          {isHost && <GhostBtn onClick={onNewRound}>{fr.end.new_round}</GhostBtn>}
          <GhostBtn onClick={onLeave}>{fr.end.leave}</GhostBtn>
        </div>
      }
    >
      <div className="w-full max-w-sm pt-8 pb-4">
        <p className="text-center text-sm mb-6" style={{ color: C.muted, fontFamily: 'var(--font-body)' }}>
          {fr.end.rounds_played(totalRounds)}
        </p>

        {/* Group title */}
        <div
          className="rounded-3xl p-6 text-center mb-6"
          style={{ background: C.surface, border: `1px solid ${C.a}44` }}
        >
          <p className="text-xs mb-2" style={{ color: C.muted, fontFamily: 'var(--font-body)' }}>
            {fr.end.group_title_label}
          </p>
          <h1
            className="text-3xl font-extrabold mb-3"
            style={{ fontFamily: 'var(--font-display)', color: C.a }}
          >
            {title.name}
          </h1>
          <p className="text-sm leading-relaxed" style={{ color: C.muted, fontFamily: 'var(--font-body)' }}>
            {title.desc}
          </p>
        </div>

        {/* Players */}
        <div className="flex flex-col gap-2">
          {players.map((p, i) => (
            <div
              key={p.id}
              className="flex items-center gap-3 rounded-2xl p-3"
              style={{ background: C.surface }}
            >
              <PlayerAvatar pseudo={p.pseudo} index={i} size={36} />
              <span className="font-medium text-sm" style={{ fontFamily: 'var(--font-body)' }}>
                {p.pseudo}
              </span>
            </div>
          ))}
        </div>

        <p className="text-center text-xs mt-6" style={{ color: C.faint, fontFamily: 'var(--font-body)' }}>
          {fr.end.thanks}
        </p>
      </div>

      {/* Share card modal */}
      {showCard && (
        <div
          className="fixed inset-0 z-[60] flex flex-col items-center justify-center p-5"
          style={{ background: 'rgba(0,0,0,0.85)' }}
          onClick={() => !exporting && setShowCard(false)}
        >
          <div onClick={(e) => e.stopPropagation()} className="flex flex-col items-center gap-4">
            {/* Scaled-down preview of the 540px card */}
            <div style={{ transform: 'scale(0.62)', transformOrigin: 'center', borderRadius: 16, overflow: 'hidden' }}>
              <ShareCard ref={cardRef} theme={theme} titleName={title.name} statText={statText} players={players} />
            </div>
            <div className="flex flex-col gap-2 w-full" style={{ maxWidth: 320 }}>
              <PrimaryBtn onClick={exportCard} accent={C.a} disabled={exporting}>
                {exporting ? fr.card.generating : fr.card.download}
              </PrimaryBtn>
              <GhostBtn onClick={() => setShowCard(false)}>{fr.card.close}</GhostBtn>
            </div>
          </div>
        </div>
      )}
    </GameScreen>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function voteTypeForPhase(phase: string | undefined): string | null {
  switch (phase) {
    case 'voting_question': return 'question_selection'
    case 'round_a_vote': return 'designation'
    case 'round_b_vote': return 'confession'
    case 'round_c_volunteer': return 'volunteer'
    case 'round_c_vote': return 'designation'
    default: return null
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export default function GamePage() {
  const fr = useT()
  const params = useParams<{ code: string }>()
  const code = params?.code ?? ''
  const router = useRouter()

  const [room, setRoom] = useState<Room | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [myId, setMyId] = useState<string | null>(null)
  const [hasVoted, setHasVoted] = useState(false)
  const [voteCount, setVoteCount] = useState(0)

  const prevPhaseRef = useRef<string | null>(null)
  const roomRef = useRef<Room | null>(null)
  const playersRef = useRef<Player[]>([])
  const voteChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  useEffect(() => {
    const id = sessionStorage.getItem('player_id')
    setMyId(id)

    async function init() {
      const { data: roomData } = await supabase
        .from('rooms').select().eq('code', code).single()

      if (!roomData) { router.push('/'); return }
      setRoom(roomData as Room)
      roomRef.current = roomData as Room

      const { data: playersData } = await supabase
        .from('players').select().eq('room_id', roomData.id)

      if (playersData) {
        setPlayers(playersData as Player[])
        playersRef.current = playersData as Player[]
      }

      const gs = roomData.game_state
      const voteType = voteTypeForPhase(gs?.phase)
      if (id && gs && voteType) {
        const { count } = await supabase
          .from('votes')
          .select('*', { count: 'exact', head: true })
          .eq('room_id', roomData.id)
          .eq('round', gs.round)
          .eq('player_id', id)
          .eq('vote_type', voteType)
        if ((count ?? 0) > 0) setHasVoted(true)
      }
    }

    // Apply a fresh room object to state, resetting per-phase UI when the phase changes.
    function applyRoom(updated: Room) {
      setRoom(updated)
      roomRef.current = updated
      const newPhase = updated.game_state?.phase
      if (newPhase !== prevPhaseRef.current) {
        setHasVoted(false)
        setVoteCount(0)
        prevPhaseRef.current = newPhase ?? null
      }
    }

    // Re-fetch the room from the DB — used as the reliable convergence path so
    // we don't depend solely on postgres_changes delivering the full payload.
    async function refetchRoom() {
      const { data } = await supabase.from('rooms').select().eq('code', code).single()
      if (data) applyRoom(data as Room)
    }

    let voteChannel: ReturnType<typeof supabase.channel> | null = null

    async function setup() {
      await init()
      const r = roomRef.current
      if (!r) return

      voteChannel = supabase
        .channel(`votes-broadcast-${r.id}`, { config: { broadcast: { self: true } } })
        .on('broadcast', { event: 'vote_count' }, ({ payload }) => {
          const gs = roomRef.current?.game_state
          if (!gs) return
          if (payload.round === gs.round) setVoteCount(payload.count as number)
        })
        .on('broadcast', { event: 'phase_changed' }, () => {
          // Someone advanced the game — pull the fresh state from the DB.
          refetchRoom()
        })
        .subscribe()

      voteChannelRef.current = voteChannel
    }

    const roomChannel = supabase
      .channel(`game-${code}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'rooms', filter: `code=eq.${code}`,
      }, (payload) => {
        applyRoom(payload.new as Room)
      })
      // Keep the player list live so the vote threshold tracks joins/leaves.
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'players',
      }, (payload) => {
        if (payload.new.room_id !== roomRef.current?.id) return
        setPlayers((prev) => {
          if (prev.find((p) => p.id === payload.new.id)) return prev
          const next = [...prev, payload.new as Player]
          playersRef.current = next
          return next
        })
      })
      .on('postgres_changes', {
        event: 'DELETE', schema: 'public', table: 'players',
      }, (payload) => {
        setPlayers((prev) => {
          const next = prev.filter((p) => p.id !== payload.old.id)
          playersRef.current = next
          return next
        })
      })
      // Reflect role changes (e.g. host transfer when the host quits).
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'players',
      }, (payload) => {
        if (payload.new.room_id !== roomRef.current?.id) return
        setPlayers((prev) => {
          const next = prev.map((p) => (p.id === payload.new.id ? (payload.new as Player) : p))
          playersRef.current = next
          return next
        })
      })
      .subscribe()

    setup()

    return () => {
      supabase.removeChannel(roomChannel)
      if (voteChannel) supabase.removeChannel(voteChannel)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code])

  // Host stopped the session → everyone returns to the lobby to pick a theme.
  useEffect(() => {
    if (room && room.status === 'waiting') {
      router.replace(`/room/${code}/lobby`)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.status])

  if (!room || !myId) return <LoadingScreen />
  const gs = room.game_state
  if (!gs) return <LoadingScreen />

  const me = players.find((p) => p.id === myId)
  const isHost = me?.is_host ?? false
  const accent = accentForType(gs.current_question?.type)

  // Write the new game state, then broadcast so every client re-fetches it —
  // this is the reliable convergence path, independent of postgres_changes.
  async function advance(next: GameState) {
    if (!room) return
    await updateRoomGameState(room.id, next)
    await voteChannelRef.current?.send({
      type: 'broadcast', event: 'phase_changed', payload: { phase: next.phase },
    })
  }

  async function submitVote(voteData: Record<string, unknown>, voteType: string) {
    if (!room || hasVoted) return
    setHasVoted(true)

    const { error: voteError } = await supabase.from('votes').insert({
      room_id: room.id, round: gs!.round, player_id: myId, vote_type: voteType, ...voteData,
    })

    if (voteError) {
      console.error('[vote error]', voteError)
      setHasVoted(false)
      return
    }

    const count = await countVotes(room.id, gs!.round, voteType)
    setVoteCount(count)

    await voteChannelRef.current?.send({
      type: 'broadcast', event: 'vote_count', payload: { count, round: gs!.round },
    })

    if (count >= players.length) await resolveVotes(voteType)
  }

  async function resolveVotes(voteType: string) {
    if (!room || !gs) return
    const votes = await fetchVotes(room.id, gs.round, voteType)

    if (voteType === 'question_selection') {
      const winnerIndex = tallyQuestionSelection(votes)
      const chosen = gs.candidates[winnerIndex] ?? gs.candidates[0]
      const nextPhase = chosen.type === 'A' ? 'round_a_vote' : chosen.type === 'B' ? 'round_b_vote' : 'round_c_volunteer'
      await advance({
        ...gs, phase: nextPhase as GameState['phase'],
        current_question: chosen, played_question_ids: [...gs.played_question_ids, chosen.id],
      })
      return
    }

    if (voteType === 'designation') {
      const { topIds, tieAll } = tallyDesignation(votes, players.length)
      await advance({
        ...gs,
        phase: gs.current_question?.type === 'A' ? 'round_a_reveal' : 'round_c_vote_reveal',
        designated_player_ids: topIds,
        designation_tie_all: tieAll,
      })
      return
    }

    if (voteType === 'confession') {
      const yesVotes = votes.filter((v) => v.answer === true)
      const pct = Math.round((yesVotes.length / players.length) * 100)
      const subtype = pickBSubtype(room.theme)
      if (subtype === 'B1') {
        await advance({
          ...gs, phase: 'round_b1_reveal', b_subtype: 'B1',
          revealed_player_ids: yesVotes.map((v) => v.player_id as string), yes_percentage: pct,
        })
      } else {
        const yesIds = yesVotes.map((v) => v.player_id as string)
        const winner = yesIds.length > 0 ? yesIds[Math.floor(Math.random() * yesIds.length)] : null
        await advance({
          ...gs, phase: 'round_b2_roulette', b_subtype: 'B2',
          // Store the yes-ids (not displayed) so we know how many stay anonymous.
          revealed_player_ids: yesIds,
          designated_player_id: winner, yes_percentage: pct,
        })
      }
    }
  }

  async function onVolunteer() {
    if (!room || !gs) return
    await supabase.from('votes').insert({
      room_id: room.id, round: gs.round, player_id: myId, vote_type: 'volunteer',
    }).then(async () => {
      const votes = await fetchVotes(room.id, gs.round, 'volunteer')
      if (votes.length === 1) {
        await advance({
          ...gs, phase: 'round_c_volunteer_reveal', volunteer_player_id: votes[0].player_id as string,
        })
      }
    })
  }

  async function onVolunteerSkip() {
    if (!room || !gs || !isHost) return
    await advance({ ...gs, phase: 'round_c_vote' })
  }

  async function onPause() {
    if (!room || !gs || !isHost) return
    await advance({ ...gs, paused: true })
  }

  async function onResume() {
    if (!room || !gs || !isHost) return
    await advance({ ...gs, paused: false })
  }

  async function onRevealB2() {
    if (!room || !gs || !isHost) return
    await advance({ ...gs, b2_revealed: true })
  }

  async function onNextRound() {
    if (!room || !gs || !isHost) return
    const stats = accumulateStats(gs)

    // Cap the session at MAX_ROUNDS — after the last round, go to the end screen.
    if (gs.round >= MAX_ROUNDS) {
      await advance({ ...gs, phase: 'ended', stats })
      return
    }

    const nextRound = gs.round + 1
    // Pass the current type so the next round avoids chaining the same one.
    const candidates = await pickCandidates(room.theme, nextRound, gs.played_question_ids, gs.current_question?.type)
    await advance({
      ...gs, phase: 'voting_question', round: nextRound, candidates,
      current_question: null, b_subtype: null, designated_player_id: null,
      designated_player_ids: [], designation_tie_all: false,
      revealed_player_ids: [], yes_percentage: null, volunteer_player_id: null,
      b2_revealed: false, stats,
    })
  }

  async function onEndGame() {
    if (!room || !gs || !isHost) return
    const stats = accumulateStats(gs)
    await advance({ ...gs, phase: 'ended', stats })
  }

  // Host stops the session and sends everyone back to the lobby, where the theme
  // can be changed and a new game started — without recreating the room.
  async function returnToLobby() {
    if (!room || !isHost) return
    await supabase.from('rooms').update({ status: 'waiting', game_state: null }).eq('id', room.id)
    await voteChannelRef.current?.send({ type: 'broadcast', event: 'phase_changed', payload: {} })
  }

  // A player leaves; the game continues for everyone else.
  // - Their row is removed so the vote threshold on other clients adjusts down.
  // - If they were the host, the role passes to the earliest remaining joiner.
  // - If they were the last one, the room is deleted (votes cascade away with it).
  async function onQuit() {
    if (!room || !myId) { router.push('/'); return }
    const wasHost = isHost

    await supabase.from('players').delete().eq('id', myId)

    const { data: rest } = await supabase.from('players').select().eq('room_id', room.id)
    const remaining = (rest ?? []) as Player[]

    if (remaining.length === 0) {
      await supabase.from('rooms').delete().eq('id', room.id)
    } else if (wasHost) {
      // Promote the earliest joiner among those left (the one who joined right after).
      const next = [...remaining].sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''))[0]
      await supabase.from('players').update({ is_host: true }).eq('id', next.id)
    }

    router.push('/')
  }

  if (gs.paused) return <PausedScreen isHost={isHost} onResume={onResume} onStop={returnToLobby} />

  const pauseBtn = isHost && gs.phase !== 'ended' && <PauseBtn onPause={onPause} />
  const quitBtn = gs.phase !== 'ended' && (
    <QuitBtn onQuit={() => { if (typeof window === 'undefined' || window.confirm(fr.game.quit_confirm)) onQuit() }} />
  )
  const nextLabel = gs.round >= MAX_ROUNDS ? fr.game.see_results : fr.game.next_round

  const screen = (() => {
    switch (gs.phase) {
      case 'voting_question':
        return <QuestionSelectionScreen gs={gs} isHost={isHost} hasVoted={hasVoted} voteCount={voteCount} playerCount={players.length} onVote={(i) => submitVote({ question_index: i }, 'question_selection')} onForce={() => resolveVotes('question_selection')} />
      case 'round_a_vote':
        return <DesignationVoteScreen gs={gs} players={players} myId={myId} isHost={isHost} hasVoted={hasVoted} voteCount={voteCount} accent={C.a} onVote={(id) => submitVote({ target_player_id: id }, 'designation')} onForce={() => resolveVotes('designation')} />
      case 'round_a_reveal':
        return <DesignationRevealScreen gs={gs} players={players} isHost={isHost} accent={C.a} nextLabel={nextLabel} onNext={onNextRound} onEnd={onEndGame} />
      case 'round_b_vote':
        return <ConfessionVoteScreen gs={gs} players={players} isHost={isHost} hasVoted={hasVoted} voteCount={voteCount} onVote={(a) => submitVote({ answer: a }, 'confession')} onForce={() => resolveVotes('confession')} />
      case 'round_b1_reveal':
        return <B1RevealScreen gs={gs} players={players} isHost={isHost} nextLabel={nextLabel} onNext={onNextRound} onEnd={onEndGame} />
      case 'round_b2_roulette':
        return <B2RouletteScreen gs={gs} players={players} isHost={isHost} nextLabel={nextLabel} onReveal={onRevealB2} onNext={onNextRound} onEnd={onEndGame} />
      case 'round_c_volunteer':
        return <VolunteerScreen gs={gs} myId={myId} isHost={isHost} onVolunteer={onVolunteer} onSkip={onVolunteerSkip} />
      case 'round_c_volunteer_reveal':
        return <VolunteerRevealScreen gs={gs} players={players} isHost={isHost} nextLabel={nextLabel} onNext={onNextRound} onEnd={onEndGame} />
      case 'round_c_vote':
        return <DesignationVoteScreen gs={gs} players={players} myId={myId} isHost={isHost} hasVoted={hasVoted} voteCount={voteCount} accent={C.c} onVote={(id) => submitVote({ target_player_id: id }, 'designation')} onForce={() => resolveVotes('designation')} />
      case 'round_c_vote_reveal':
        return <DesignationRevealScreen gs={gs} players={players} isHost={isHost} accent={C.c} nextLabel={nextLabel} onNext={onNextRound} onEnd={onEndGame} />
      case 'ended':
        return <EndScreen gs={gs} players={players} isHost={isHost} theme={room.theme} onNewRound={returnToLobby} onLeave={onQuit} />
      default:
        return <LoadingScreen />
    }
  })()

  return <>{pauseBtn}{quitBtn}{screen}</>
}
