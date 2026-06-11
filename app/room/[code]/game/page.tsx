'use client'

import { createContext, forwardRef, useContext, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  accumulateStats,
  computeGroupTitle,
  countChoiceVotes,
  countVotes,
  fetchVotes,
  pickCandidates,
  tallyDesignation,
  tallyQuestionSelection,
  updateRoomGameState,
} from '@/lib/game'
import { useT, useLocale } from '@/lib/locale'
import { useRoomPresence } from '@/lib/usePresence'
import { getPlayerId, clearPlayerId } from '@/lib/utils'
import type { Dict } from '@/lib/i18n'
import { GameState, Player, Question, Room } from '@/lib/types'

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
// In-round controls context — exposes quit/pause handlers to RoundHeader
// so every screen gets the buttons without prop drilling.
// ---------------------------------------------------------------------------

type GameControls = { onQuit: () => void; onPause: () => void }
const GameControlsCtx = createContext<GameControls | null>(null)

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
      {/* header/body/footer share one centered max-width column so nothing
          stretches edge-to-edge on desktop (footer buttons, round header). */}
      {header && (
        <div style={{ padding: '16px 20px 0', flexShrink: 0 }}>
          <div className="mx-auto w-full" style={{ maxWidth: 448 }}>{header}</div>
        </div>
      )}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {children}
      </div>
      {footer && (
        <div style={{ padding: '12px 20px 32px', flexShrink: 0 }}>
          <div className="mx-auto w-full" style={{ maxWidth: 448 }}>{footer}</div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

function RoundHeader({ round, label, accent }: {
  round: number; label: string; accent: string
}) {
  const fr = useT()
  const controls = useContext(GameControlsCtx)
  return (
    <div className="mb-4">
      {/* Accent bar — full width, signals the round type */}
      <div className="h-1 w-full rounded-full mb-2" style={{ background: accent }} />
      {/* Action row: quit · type indicator · round counter · pause — all inline */}
      <div className="flex items-center gap-2">
        {controls && (
          <button
            onClick={controls.onQuit}
            className="px-3 h-8 rounded-xl text-xs font-medium flex-shrink-0"
            style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.muted, fontFamily: 'var(--font-body)' }}
          >
            {fr.game.quit}
          </button>
        )}
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: accent }} />
        <span
          className="font-extrabold uppercase flex-1 truncate"
          style={{ color: accent, fontSize: 14, letterSpacing: '0.04em', fontFamily: 'var(--font-display)' }}
        >
          {label}
        </span>
        <span className="flex-shrink-0" style={{ color: C.muted, fontSize: 12, fontFamily: 'var(--font-body)' }}>
          {fr.game.round_of(round, MAX_ROUNDS)}
        </span>
        {controls && (
          <button
            onClick={controls.onPause}
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: C.surface, border: `1px solid ${C.border}` }}
            aria-label="Pause"
          >
            ⏸
          </button>
        )}
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

// 30-second countdown shown during vote phases. Only the elected advancer
// (smallest player id) fires onExpire to avoid race conditions between clients.
function VoteTimer({ isAdvancer, onExpire, initialSecs = 30 }: { isAdvancer: boolean; onExpire: () => void; initialSecs?: number }) {
  const [secs, setSecs] = useState(initialSecs)
  // Keep the latest props without re-subscribing the interval. Synced in an
  // effect (not during render) so the interval reads fresh values at expiry.
  const latest = useRef({ isAdvancer, onExpire })
  useEffect(() => { latest.current = { isAdvancer, onExpire } })

  // Single 1s tick down to 0.
  useEffect(() => {
    const id = setInterval(() => setSecs((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(id)
  }, [])

  // Fire the auto-skip once, from the elected advancer only.
  const fired = useRef(false)
  useEffect(() => {
    if (secs === 0 && !fired.current && latest.current.isAdvancer) {
      fired.current = true
      latest.current.onExpire()
    }
  }, [secs])

  const danger = secs <= 10
  const circumference = 2 * Math.PI * 14
  const dash = Math.max(0, (secs / 30) * circumference)

  return (
    <div className="flex items-center justify-center mt-3">
      <div style={{ position: 'relative', width: 40, height: 40 }}>
        <svg width="40" height="40" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="20" cy="20" r="14" fill="none" stroke={C.border} strokeWidth="3" />
          <circle
            cx="20" cy="20" r="14" fill="none"
            stroke={danger ? C.a : C.muted}
            strokeWidth="3"
            strokeDasharray={`${dash} ${circumference}`}
            strokeLinecap="round"
          />
        </svg>
        <span
          style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            fontSize: 11, fontWeight: 700,
            color: danger ? C.a : C.muted,
            fontFamily: 'var(--font-body)',
          }}
        >
          {secs}
        </span>
      </div>
    </div>
  )
}

// VoteTimer with elapsed-time correction — keyed by round at the call site so
// it remounts (resetting internal state) each time the round changes.
function RoundTimer({ gs, isAdvancer, onExpire }: { gs: GameState; isAdvancer: boolean; onExpire: () => void }) {
  // Lazy initializer: VoteTimer only reads initialSecs at mount, and RoundTimer
  // is keyed by round at every call site, so computing once is equivalent.
  const [initialSecs] = useState(() => {
    const elapsed = gs.round_started_at ? Math.floor((Date.now() - new Date(gs.round_started_at).getTime()) / 1000) : 0
    return Math.max(0, 30 - elapsed)
  })
  return <VoteTimer isAdvancer={isAdvancer} onExpire={onExpire} initialSecs={initialSecs} />
}

// Shared footer for round-end (reveal) screens. Only the host can advance
// to the next round — prevents trolling or accidental skips.
function RoundEndFooter({
  ready, isHost, nextLabel, accent, textDark = false, onNext, onEnd,
}: {
  ready: boolean; isHost: boolean; nextLabel: string; accent: string; textDark?: boolean; onNext: () => void; onEnd: () => void
}) {
  const fr = useT()
  if (!ready) return <WaitingDots />
  return (
    <div className="flex flex-col gap-2">
      {isHost ? (
        <PrimaryBtn onClick={onNext} accent={accent} textDark={textDark}>
          {nextLabel}
        </PrimaryBtn>
      ) : (
        <p className="text-center text-sm py-2" style={{ color: C.muted, fontFamily: 'var(--font-body)' }}>
          {fr.game.waiting_host_advance}
        </p>
      )}
      {isHost && <GhostBtn onClick={onEnd}>{fr.game.end_game}</GhostBtn>}
    </div>
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
      footer={
        <div className="flex flex-col gap-2">
          <PrimaryBtn onClick={onResume} accent={C.a}>{fr.game.resume}</PrimaryBtn>
          {isHost && <GhostBtn onClick={onStop}>{fr.game.stop_game}</GhostBtn>}
        </div>
      }
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

// ---- Question reveal interstitial (2.5 s shown when voting_question resolves) ----

function QuestionRevealScreen({ question, wasYours }: { question: Question; wasYours: boolean | null }) {
  const fr = useT()
  const { locale } = useLocale()
  const [progress, setProgress] = useState(100)
  useEffect(() => {
    const start = Date.now()
    const duration = 2500
    const id = setInterval(() => {
      const elapsed = Date.now() - start
      setProgress(Math.max(0, 100 - (elapsed / duration) * 100))
      if (elapsed >= duration) clearInterval(id)
    }, 50)
    return () => clearInterval(id)
  }, [])
  const badge = wasYours === true ? fr.voting_question.chosen_yours
    : wasYours === false ? fr.voting_question.chosen_not_yours
    : null
  const badgeColor = wasYours === true ? '#00C896' : C.muted
  return (
    <GameScreen footer={null}>
      <div className="flex-1 flex flex-col items-center justify-center gap-6 px-2">
        {badge && (
          <span
            className="text-sm font-bold px-4 py-1.5 rounded-full"
            style={{ background: wasYours ? '#00C89622' : '#55555522', color: badgeColor, fontFamily: 'var(--font-body)' }}
          >
            {badge}
          </span>
        )}
        <div
          className="w-full rounded-2xl p-6 text-center"
          style={{ background: C.surface, border: `1px solid ${C.border}` }}
        >
          <p className="text-lg font-semibold leading-snug" style={{ fontFamily: 'var(--font-body)' }}>
            {question.question[locale] ?? question.question.fr}
          </p>
        </div>
        <div className="w-full rounded-full overflow-hidden" style={{ height: 3, background: C.border }}>
          <div
            className="h-full rounded-full transition-none"
            style={{ width: `${progress}%`, background: badgeColor }}
          />
        </div>
      </div>
    </GameScreen>
  )
}

// ---- Question selection ----

function QuestionSelectionScreen({
  gs, isHost, isAdvancer, hasVoted, voteCount, playerCount, onVote, onForce,
}: {
  gs: GameState; isHost: boolean; isAdvancer: boolean; hasVoted: boolean; voteCount: number; playerCount: number; onVote: (i: number) => void; onForce: () => void}) {
  const fr = useT()
  const { locale } = useLocale()
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  // A round has a single type — read it once from the candidates.
  const roundType = gs.candidates[0]?.type
  const accent = accentForType(roundType)
  const typeLabel = roundType === 'A' ? fr.designation.label : roundType === 'B' ? fr.confession.label : fr.question_ouverte.label

  function handleVote(i: number) {
    if (hasVoted) return
    setSelectedIndex(i)
    onVote(i)
  }

  return (
    <GameScreen header={<RoundHeader round={gs.round} label={typeLabel} accent={accent} />}>
      <div className="w-full max-w-md pt-4">
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
          {gs.candidates.map((q, i) => {
            const isSelected = selectedIndex === i
            return (
              <button
                key={q.id}
                onClick={() => handleVote(i)}
                disabled={hasVoted && !isSelected}
                className="rounded-2xl p-4 text-left transition-all"
                style={{
                  background: isSelected ? `${accent}22` : C.surface,
                  border: `2px solid ${isSelected ? accent : hasVoted ? C.border : accent + '33'}`,
                  opacity: hasVoted && !isSelected ? 0.4 : 1,
                }}
              >
                <div className="flex items-start gap-3">
                  {isSelected && (
                    <span style={{ color: accent, fontSize: 16, flexShrink: 0, marginTop: 1 }}>✓</span>
                  )}
                  <p className="text-sm leading-snug" style={{ color: C.text, fontFamily: 'var(--font-body)' }}>
                    {q.question[locale]}
                  </p>
                </div>
              </button>
            )
          })}
        </div>

        <VoteProgress count={voteCount} total={playerCount} voted={hasVoted} />
        <RoundTimer key={`vt-${gs.round}`} gs={gs} isAdvancer={isAdvancer} onExpire={onForce} />
        <HostSkipBtn show={isHost && hasVoted && voteCount < playerCount} onForce={onForce} />
      </div>
    </GameScreen>
  )
}

// ---- Designation vote (Type A + Type C vote) ----

function DesignationVoteScreen({
  gs, players, myId, isHost, isAdvancer, hasVoted, voteCount, accent, onVote, onForce,
}: {
  gs: GameState; players: Player[]; myId: string | null; isHost: boolean; isAdvancer: boolean; hasVoted: boolean; voteCount: number; accent: string; onVote: (id: string) => void; onForce: () => void}) {
  const fr = useT()
  const { locale } = useLocale()
  const q = gs.current_question!
  const label = fr.designation.label
  const instruction = fr.designation.instruction
  // Everyone is votable — including yourself (you can own a "le plus susceptible de…").
  // This also lets a 2-player group break out of the forced full-tie.

  return (
    <GameScreen
      header={<RoundHeader round={gs.round} label={label} accent={accent} />}
      footer={
        <>
          <VoteProgress count={voteCount} total={players.length} voted={hasVoted} />
          <RoundTimer key={`vt-${gs.round}`} gs={gs} isAdvancer={isAdvancer} onExpire={onForce} />
          <HostSkipBtn show={isHost && hasVoted && voteCount < players.length} onForce={onForce} />
        </>
      }
    >
      <div className="w-full max-w-md">
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
  gs: GameState; players: Player[]; isHost: boolean; accent: string; nextLabel: string; onNext: () => void; onEnd: () => void}) {
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
      footer={<RoundEndFooter ready={shown} isHost={isHost} nextLabel={nextLabel} accent={accent} onNext={onNext} onEnd={onEnd} />}
    >
      <div className="w-full max-w-md flex flex-col items-center">
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
            <p className="mt-2 text-sm font-semibold text-center" style={{ color: accent, fontFamily: 'var(--font-body)' }}>
              {fr.designation.prompt_many}
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
            <p className="mt-3 text-sm font-semibold text-center" style={{ color: accent, fontFamily: 'var(--font-body)' }}>
              {fr.designation.prompt_one}
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
  gs, players, isHost, isAdvancer, hasVoted, voteCount, onVote, onForce,
}: {
  gs: GameState; players: Player[]; isHost: boolean; isAdvancer: boolean; hasVoted: boolean; voteCount: number; onVote: (a: boolean) => void; onForce: () => void}) {
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
      <div className="w-full max-w-md">
        <QuestionCard text={q.question[locale]} accent={C.b} />
        {hasVoted ? (
          <WaitingDots />
        ) : (
          <p className="text-center text-xs" style={{ color: C.faint, fontFamily: 'var(--font-body)' }}>
            {fr.confession.answer_private}
          </p>
        )}
        <VoteProgress count={voteCount} total={players.length} voted={hasVoted} />
        <RoundTimer key={`vt-${gs.round}`} gs={gs} isAdvancer={isAdvancer} onExpire={onForce} />
        <HostSkipBtn show={isHost && hasVoted && voteCount < players.length} onForce={onForce} />
      </div>
    </GameScreen>
  )
}

// ---- Confession roulette (ex-B2 ; seul mode de confession désormais) ----

function B2RouletteScreen({
  gs, players, isHost, nextLabel, onReveal, onNext, onEnd,
}: {
  gs: GameState; players: Player[]; isHost: boolean; nextLabel: string; onReveal: () => void; onNext: () => void; onEnd: () => void}) {
  const fr = useT()
  const { locale } = useLocale()
  const q = gs.current_question!
  const designated = players.find((p) => p.id === gs.designated_player_id)
  const name = designated?.pseudo ?? '?'
  const idx = designated ? players.indexOf(designated) : 0
  const pct = gs.yes_percentage ?? 0
  const yesCount = gs.revealed_player_ids?.length ?? 0
  // Use pct as the canonical source of truth for nobody/allYes — pct is set
  // from the frozen vote snapshot at resolution, so it does not change if the
  // roster later shifts. revealed_player_ids has dual semantics (all yes-ids at
  // resolution; just the winner after roulette) which makes yesCount === 0 fragile.
  const nobody = pct === 0
  const allYes = pct === 100
  // Everyone who said yes except the one the roulette picked stays anonymous.
  const othersCount = Math.max(0, yesCount - 1)

  // The roulette spins on every client when the host triggers gs.b2_revealed.
  const [spinIndex, setSpinIndex] = useState(0)
  const [done, setDone] = useState(false)

  const [tick, setTick] = useState(0) // drives the per-change pulse

  useEffect(() => {
    if (!gs.b2_revealed || nobody || allYes || players.length === 0) return
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

  const spinning = gs.b2_revealed && !done && !nobody && !allYes
  const spinPlayer = players[spinIndex]

  return (
    <GameScreen
      header={<RoundHeader round={gs.round} label={fr.confession.label} accent={C.b} />}
      footer={
        nobody || allYes ? (
          <RoundEndFooter ready isHost={isHost} nextLabel={nextLabel} accent={C.b} onNext={onNext} onEnd={onEnd} />
        ) : !gs.b2_revealed ? (
          <PrimaryBtn onClick={onReveal} accent={C.b}>{fr.confession.b2_btn_reveal}</PrimaryBtn>
        ) : done ? (
          <RoundEndFooter ready isHost={isHost} nextLabel={nextLabel} accent={C.b} onNext={onNext} onEnd={onEnd} />
        ) : (
          <WaitingDots />
        )
      }
    >
      <div className="w-full max-w-md flex flex-col items-center">
        {/* Keep the question visible while the wheel reveals who confessed. */}
        <QuestionCard text={q.question[locale]} accent={C.b} />
        <p className="text-center mb-6 text-sm" style={{ color: C.muted, fontFamily: 'var(--font-body)' }}>
          {fr.confession.b2_percent(pct)}
        </p>

        {nobody ? (
          <p className="text-center mt-4" style={{ color: C.muted, fontFamily: 'var(--font-body)' }}>
            {fr.confession.b2_nobody}
          </p>
        ) : allYes ? (
          <div className="flex flex-col items-center text-center pt-2" style={{ animation: 'b2pop 0.4s ease-out' }}>
            <p className="text-6xl mb-4">🐑</p>
            <h2 className="text-2xl font-extrabold mb-2" style={{ fontFamily: 'var(--font-display)', color: C.b }}>
              {fr.confession.b2_all_yes_title}
            </h2>
            <p style={{ color: C.muted, fontFamily: 'var(--font-body)', fontSize: 14 }}>
              {fr.confession.b2_all_yes_body}
            </p>
          </div>
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

// ---- Type C choice (volunteer OR send someone) ----

function ChoiceScreen({
  gs, players, myId, isHost, isAdvancer, hasVoted, voteCount, onVolunteer, onDesignate, onForce,
}: {
  gs: GameState; players: Player[]; myId: string | null; isHost: boolean; isAdvancer: boolean; hasVoted: boolean; voteCount: number; onVolunteer: () => void; onDesignate: (id: string) => void; onForce: () => void}) {
  const fr = useT()
  const { locale } = useLocale()
  const q = gs.current_question!
  const [picking, setPicking] = useState(false)
  const others = players.filter((p) => p.id !== myId)

  return (
    <GameScreen
      header={<RoundHeader round={gs.round} label={fr.question_ouverte.label} accent={C.c} />}
      footer={
        <>
          <VoteProgress count={voteCount} total={gs.vote_round_player_count || players.length} voted={hasVoted} />
          <RoundTimer key={`vt-${gs.round}`} gs={gs} isAdvancer={isAdvancer} onExpire={onForce} />
          <HostSkipBtn show={isHost && hasVoted && voteCount < (gs.vote_round_player_count || players.length)} onForce={onForce} />
        </>
      }
    >
      <div className="w-full max-w-md">
        <QuestionCard text={q.question[locale]} accent={C.c} />

        {hasVoted ? (
          <WaitingDots />
        ) : picking ? (
          <>
            <p className="text-sm text-center mb-4" style={{ color: C.muted, fontFamily: 'var(--font-body)' }}>
              {fr.question_ouverte.designate_instruction}
            </p>
            <div className="flex flex-col gap-3">
              {others.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onDesignate(p.id)}
                  className="flex items-center gap-3 rounded-2xl p-4"
                  style={{ background: C.surface, border: `1px solid ${C.border}` }}
                >
                  <PlayerAvatar pseudo={p.pseudo} index={players.indexOf(p)} size={40} />
                  <span className="font-medium" style={{ fontFamily: 'var(--font-body)', color: C.text }}>{p.pseudo}</span>
                </button>
              ))}
            </div>
            <GhostBtn onClick={() => setPicking(false)}>← {fr.common.back}</GhostBtn>
            <p className="text-center text-xs" style={{ color: C.faint, fontFamily: 'var(--font-body)' }}>
              {fr.common.vote_anonymous}
            </p>
          </>
        ) : (
          <>
            <p className="text-center font-bold mb-4" style={{ fontFamily: 'var(--font-display)', fontSize: 18 }}>
              {fr.question_ouverte.choice_instruction}
            </p>
            <div className="flex flex-col gap-2">
              <PrimaryBtn onClick={onVolunteer} accent={C.c} textDark>{fr.question_ouverte.volunteer_btn}</PrimaryBtn>
              <SecondaryBtn onClick={() => setPicking(true)}>{fr.question_ouverte.designate_btn}</SecondaryBtn>
            </div>
          </>
        )}
      </div>
    </GameScreen>
  )
}

// ---- Type C — volunteers reveal (they all answer) ----

function VolunteersRevealScreen({
  gs, players, isHost, nextLabel, onNext, onEnd,
}: {
  gs: GameState; players: Player[]; isHost: boolean; nextLabel: string; onNext: () => void; onEnd: () => void}) {
  const fr = useT()
  const { locale } = useLocale()
  const q = gs.current_question!
  const vols = gs.volunteer_player_ids
    .map((id) => players.find((p) => p.id === id))
    .filter((p): p is Player => !!p)

  const [shown, setShown] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setShown(true), 1000)
    return () => clearTimeout(t)
  }, [])

  // Defensive guard: resolveTypeCChoice never transitions here with 0 volunteers,
  // but if it somehow does (e.g. a race or stale state), never render volunteers_reveal_*
  // text and never dereference vols[0] — just show the question and the host footer.
  if (vols.length === 0) {
    return (
      <GameScreen
        header={<RoundHeader round={gs.round} label={fr.question_ouverte.label} accent={C.c} />}
        footer={<RoundEndFooter ready isHost={isHost} nextLabel={nextLabel} accent={C.c} textDark onNext={onNext} onEnd={onEnd} />}
      >
        <div className="w-full max-w-md flex flex-col items-center">
          <QuestionCard text={q.question[locale]} accent={C.c} />
        </div>
      </GameScreen>
    )
  }

  return (
    <GameScreen
      header={<RoundHeader round={gs.round} label={fr.question_ouverte.label} accent={C.c} />}
      footer={<RoundEndFooter ready={shown} isHost={isHost} nextLabel={nextLabel} accent={C.c} textDark onNext={onNext} onEnd={onEnd} />}
    >
      <div className="w-full max-w-md flex flex-col items-center">
        <QuestionCard text={q.question[locale]} accent={C.c} />
        {!shown ? (
          <p className="text-5xl pt-2" style={{ animation: 'b2pulse 0.7s ease-in-out infinite' }}>🙋</p>
        ) : (
          <div className="flex flex-col items-center" style={{ animation: 'b2pop 0.4s ease-out' }}>
            <h2 className="text-2xl font-extrabold mb-1 text-center" style={{ fontFamily: 'var(--font-display)', color: C.c }}>
              {fr.question_ouverte.volunteers_title}
            </h2>
            <div className="flex flex-wrap justify-center gap-4 mt-3">
              {vols.map((p) => (
                <div key={p.id} className="flex flex-col items-center gap-1">
                  <PlayerAvatar pseudo={p.pseudo} index={players.indexOf(p)} size={64} />
                  <span className="text-sm font-medium" style={{ fontFamily: 'var(--font-body)' }}>{p.pseudo}</span>
                </div>
              ))}
            </div>
            <p className="mt-4 text-center" style={{ color: C.muted, fontFamily: 'var(--font-body)', fontSize: 14 }}>
              {vols.length === 1 ? fr.question_ouverte.volunteers_reveal_one(vols[0].pseudo) : fr.question_ouverte.volunteers_reveal_many}
            </p>
          </div>
        )}
      </div>
    </GameScreen>
  )
}

// ---- Type C — designation roulette (no volunteers) ----

function CRouletteScreen({
  gs, players, isHost, nextLabel, onNext, onEnd,
}: {
  gs: GameState; players: Player[]; isHost: boolean; nextLabel: string; onNext: () => void; onEnd: () => void}) {
  const fr = useT()
  const { locale } = useLocale()
  const q = gs.current_question!
  // Spin through the tied pool (fallback: everyone) and land on the chosen one.
  const pool = gs.designated_player_ids.length > 0 ? gs.designated_player_ids : players.map((p) => p.id)
  const winner = players.find((p) => p.id === gs.designated_player_id)
  const name = winner?.pseudo ?? '?'
  const idx = winner ? players.indexOf(winner) : 0

  const [spinPos, setSpinPos] = useState(0)
  const [done, setDone] = useState(false)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (pool.length === 0) { setDone(true); return }
    const targetPos = Math.max(0, pool.findIndex((id) => id === gs.designated_player_id))
    let pos = 0
    let ticks = 0
    let delay = 60
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>
    const minTicks = pool.length * 5
    const step = () => {
      if (cancelled) return
      pos = (pos + 1) % pool.length
      setSpinPos(pos)
      setTick((t) => t + 1)
      ticks++
      if (ticks > minTicks) delay += 32
      if (ticks > minTicks && pos === targetPos && delay > 300) { setDone(true); return }
      timer = setTimeout(step, delay)
    }
    timer = setTimeout(step, delay)
    return () => { cancelled = true; clearTimeout(timer) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const spinPlayer = players.find((p) => p.id === pool[spinPos])

  return (
    <GameScreen
      header={<RoundHeader round={gs.round} label={fr.question_ouverte.label} accent={C.c} />}
      footer={<RoundEndFooter ready={done} isHost={isHost} nextLabel={nextLabel} accent={C.c} textDark onNext={onNext} onEnd={onEnd} />}
    >
      <div className="w-full max-w-md flex flex-col items-center">
        <QuestionCard text={q.question[locale]} accent={C.c} />
        <p className="text-center mb-3 text-sm" style={{ color: C.muted, fontFamily: 'var(--font-body)' }}>
          {fr.question_ouverte.roulette_title}
        </p>
        {!done ? (
          <div className="flex flex-col items-center">
            <div
              key={tick}
              className="rounded-full flex items-center justify-center font-extrabold"
              style={{
                width: 96, height: 96,
                background: `${(spinPlayer ? avatarColor(players.indexOf(spinPlayer)) : C.c)}33`,
                border: `3px solid ${spinPlayer ? avatarColor(players.indexOf(spinPlayer)) : C.c}`,
                boxShadow: `0 0 45px ${C.c}55`,
                color: spinPlayer ? avatarColor(players.indexOf(spinPlayer)) : C.c,
                fontSize: 38, fontFamily: 'var(--font-display)',
                animation: 'b2flick 90ms ease-out',
              }}
            >
              {spinPlayer ? playerInitial(spinPlayer.pseudo) : '?'}
            </div>
            <h2 key={`n-${tick}`} className="text-3xl font-extrabold mt-4 text-center" style={{ fontFamily: 'var(--font-display)', animation: 'b2flick 90ms ease-out' }}>
              {spinPlayer ? spinPlayer.pseudo : '?'}
            </h2>
          </div>
        ) : (
          <div className="flex flex-col items-center" style={{ animation: 'b2pop 0.4s ease-out' }}>
            <PlayerAvatar pseudo={name} index={idx} size={96} />
            <h2 className="text-3xl font-extrabold mt-4 mb-2 text-center" style={{ fontFamily: 'var(--font-display)' }}>
              {name}
            </h2>
            <p style={{ color: C.c, fontFamily: 'var(--font-body)', fontSize: 14 }}>
              {fr.question_ouverte.designated_reveal(name)}
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

type PlayerStats = { designated: number; confessed: number; volunteered: number }

// Square share card (rendered to PNG via modern-screenshot).
const ShareCard = forwardRef<HTMLDivElement, {
  theme: string
  titleName: string
  statText: string
  players: Player[]
  myPseudo?: string
  myStats?: PlayerStats
}>(function ShareCard({ theme, titleName, statText, players, myPseudo, myStats }, ref) {
  const fr = useT()
  const meta = THEME_META[theme] ?? { name: theme, color: C.a }
  const hasPersonal = myStats && (myStats.designated > 0 || myStats.confessed > 0 || myStats.volunteered > 0)

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

      {/* gap-based column (no marginTop:auto) so nothing overlaps when rendered to canvas */}
      <div style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', flex: 1, gap: 16, minHeight: 0 }}>
        {/* Theme + logo */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <span style={{ color: meta.color, fontSize: 16, fontWeight: 700 }}>{meta.name}</span>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, color: '#fff' }}>
            Klu<span style={{ color: meta.color }}>up</span>
          </span>
        </div>

        {/* Group title */}
        <div style={{ flexShrink: 0 }}>
          <p style={{ color: C.muted, fontSize: 14, margin: 0 }}>{fr.end.group_title_label}</p>
          <h1 style={{
            fontFamily: 'var(--font-display)', fontWeight: 800, color: '#fff',
            fontSize: 42, lineHeight: 1.1, margin: '6px 0 0',
          }}>
            {titleName}
          </h1>
        </div>

        {/* Moment fort */}
        <div style={{
          background: C.surface, borderRadius: 18, padding: '14px 18px',
          borderLeft: `4px solid ${meta.color}`, flexShrink: 0,
        }}>
          <p style={{ color: C.muted, fontSize: 12, margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {fr.card.moment}
          </p>
          <p style={{ color: '#fff', fontSize: 16, fontWeight: 500, margin: '6px 0 0', lineHeight: 1.35 }}>
            {statText}
          </p>
        </div>

        {/* Personal stats — only shown when the player has at least one event */}
        {hasPersonal && myPseudo && (
          <div style={{ background: C.surface, borderRadius: 18, padding: '14px 18px', flexShrink: 0 }}>
            <p style={{ color: C.muted, fontSize: 11, margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {myPseudo} · {fr.card.tonight}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {myStats!.designated > 0 && (
                <span style={{ background: `${C.a}22`, color: C.a, fontSize: 13, fontWeight: 600, borderRadius: 999, padding: '4px 12px' }}>
                  {fr.end.stat_designated(myStats!.designated)}
                </span>
              )}
              {myStats!.confessed > 0 && (
                <span style={{ background: `${C.b}22`, color: C.b, fontSize: 13, fontWeight: 600, borderRadius: 999, padding: '4px 12px' }}>
                  {fr.end.stat_confessed(myStats!.confessed)}
                </span>
              )}
              {myStats!.volunteered > 0 && (
                <span style={{ background: `${C.c}22`, color: C.c, fontSize: 13, fontWeight: 600, borderRadius: 999, padding: '4px 12px' }}>
                  {fr.end.stat_volunteered(myStats!.volunteered)}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Spacer pushes players + footer to the bottom */}
        <div style={{ flex: 1, minHeight: 0 }} />

        {/* Players pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, flexShrink: 0 }}>
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

        <p style={{ color: C.faint, fontSize: 13, margin: 0, textAlign: 'center', flexShrink: 0 }}>
          {fr.card.footer}
        </p>
      </div>
    </div>
  )
})

// ---- End screen ----

function EndScreen({
  gs, players, myId, isHost, theme, onNewRound, onLeave,
}: {
  gs: GameState; players: Player[]; myId: string | null; isHost: boolean; theme: string; onNewRound: () => void; onLeave: () => void
}) {
  const fr = useT()
  // Derive from the accumulated stats so the count and the title percentages
  // share the same denominator (every completed round lands in exactly one of these).
  const totalRounds = gs.stats.rounds_a + gs.stats.rounds_b + gs.stats.rounds_c
  const titleKey = computeGroupTitle(gs.stats, theme, totalRounds)
  const title = fr.titles[titleKey]
  const statText = momentStat(titleKey, gs.stats, totalRounds, fr)

  // Personal stats for the share card — only what was publicly revealed.
  const me = players.find((p) => p.id === myId)
  const myPseudo = me?.pseudo
  const myStats: PlayerStats | undefined = myId ? {
    designated:  (gs.stats.designated  ?? {})[myId] ?? 0,
    confessed:   (gs.stats.confessed   ?? {})[myId] ?? 0,
    volunteered: (gs.stats.volunteered ?? {})[myId] ?? 0,
  } : undefined

  const [showCard, setShowCard] = useState(false)
  const [exporting, setExporting] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  async function exportCard() {
    if (!cardRef.current) return
    setExporting(true)
    try {
      // modern-screenshot renders text via the browser (SVG foreignObject), so
      // glyph metrics are correct — unlike html2canvas, which mis-measured the
      // custom fonts and overlapped the letters.
      const { domToBlob } = await import('modern-screenshot')
      if (typeof document !== 'undefined' && document.fonts) {
        try { await document.fonts.ready } catch { /* ignore */ }
      }
      const filename = `kluup-${title.name.toLowerCase().replace(/\s+/g, '-')}.png`
      const blob = await domToBlob(cardRef.current, {
        // Force the real card size — the modal shows it inside transform:scale,
        // and the capture would otherwise measure the scaled-down box and crop.
        width: 540,
        height: 540,
        scale: 2, // 540 * 2 = 1080px
        backgroundColor: C.bg,
        type: 'image/png',
      })
      if (!blob) throw new Error('domToBlob returned null')
      const file = new File([blob], filename, { type: 'image/png' })

      // On mobile, the native share sheet lets the user save to Photos / send to
      // an app — a plain download lands in Files, not the gallery.
      const nav = navigator as Navigator & { canShare?: (d: { files?: File[] }) => boolean }
      if (nav.canShare && nav.canShare({ files: [file] })) {
        try {
          await nav.share({ files: [file], title: 'Kluup' })
          return
        } catch (e) {
          if ((e as Error).name === 'AbortError') return // user dismissed the sheet
          // otherwise fall through to download
        }
      }

      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      link.click()
      URL.revokeObjectURL(url)
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
      <div className="w-full max-w-md pt-8 pb-4">
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

        {/* Players + personal stats */}
        <div className="flex flex-col gap-2">
          {players.map((p, i) => {
            const designated  = (gs.stats.designated  ?? {})[p.id] ?? 0
            const confessed   = (gs.stats.confessed   ?? {})[p.id] ?? 0
            const volunteered = (gs.stats.volunteered ?? {})[p.id] ?? 0
            const hasStats = designated > 0 || confessed > 0 || volunteered > 0
            return (
              <div key={p.id} className="rounded-2xl p-3" style={{ background: C.surface }}>
                <div className="flex items-center gap-3">
                  <PlayerAvatar pseudo={p.pseudo} index={i} size={36} />
                  <span className="font-medium text-sm flex-1" style={{ fontFamily: 'var(--font-body)' }}>
                    {p.pseudo}
                  </span>
                  {p.id === myId && (
                    <span className="text-xs" style={{ color: C.faint, fontFamily: 'var(--font-body)' }}>
                      {fr.common.you}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2" style={{ paddingLeft: 48 }}>
                  {designated > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: `${C.a}22`, color: C.a, fontFamily: 'var(--font-body)' }}>
                      {fr.end.stat_designated(designated)}
                    </span>
                  )}
                  {confessed > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: `${C.b}22`, color: C.b, fontFamily: 'var(--font-body)' }}>
                      {fr.end.stat_confessed(confessed)}
                    </span>
                  )}
                  {volunteered > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: `${C.c}22`, color: C.c, fontFamily: 'var(--font-body)' }}>
                      {fr.end.stat_volunteered(volunteered)}
                    </span>
                  )}
                  {!hasStats && (
                    <span className="text-xs" style={{ color: C.faint, fontFamily: 'var(--font-body)' }}>
                      {fr.end.stat_quiet}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
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
            {/* Full-size card rendered off-screen — captured as-is (no transform → no crop). */}
            <div style={{ position: 'fixed', top: 0, left: -10000, pointerEvents: 'none' }} aria-hidden>
              <ShareCard ref={cardRef} theme={theme} titleName={title.name} statText={statText} players={players} myPseudo={myPseudo} myStats={myStats} />
            </div>
            {/* Scaled-down visual preview (display only). */}
            <div style={{ width: 313, height: 313, overflow: 'hidden', borderRadius: 16 }}>
              <div style={{ transform: 'scale(0.58)', transformOrigin: 'top left', width: 540, height: 540 }}>
                <ShareCard theme={theme} titleName={title.name} statText={statText} players={players} myPseudo={myPseudo} myStats={myStats} />
              </div>
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
    // round_c_choice mixes volunteer + designation — handled separately in init().
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
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const prevPhaseRef = useRef<string | null>(null)
  const roomRef = useRef<Room | null>(null)
  const playersRef = useRef<Player[]>([])
  const voteChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Kept in sync with the derived isAdvancer value so async closures (broadcast
  // handlers, timers) always see the current advancer status without stale captures.
  const isAdvancerRef = useRef(false)
  // Guards resolveVotes / resolveTypeCChoice against concurrent double-calls
  // (the advancer both calls directly in submitVote and receives its own broadcast).
  const resolvingRef = useRef(false)
  // Live refs so the broadcast handler (registered once at mount) always calls
  // the current-render version of these functions — not the stale mount closure.
  const resolveVotesRef = useRef<(voteType: string) => Promise<void>>(async () => {})
  const resolveTypeCChoiceRef = useRef<() => Promise<void>>(async () => {})
  // Question-reveal interstitial: shown 2.5s when voting_question resolves.
  const [revealInfo, setRevealInfo] = useState<{ question: Question; wasYours: boolean | null } | null>(null)
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const myVoteIndexRef = useRef<number | null>(null)

  useEffect(() => {
    const id = getPlayerId(code)
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
      } else if (id && gs && gs.phase === 'round_c_choice') {
        const { count } = await supabase
          .from('votes')
          .select('*', { count: 'exact', head: true })
          .eq('room_id', roomData.id)
          .eq('round', gs.round)
          .eq('player_id', id)
          .in('vote_type', ['volunteer', 'designation'])
        if ((count ?? 0) > 0) setHasVoted(true)
      }
    }

    // Apply a fresh room object to state, resetting per-phase UI when the phase changes.
    function applyRoom(updated: Room) {
      setRoom(updated)
      roomRef.current = updated
      const newPhase = updated.game_state?.phase
      if (newPhase !== prevPhaseRef.current) {
        // Leaving voting_question → show the chosen question for 2.5s before the vote screen.
        if (prevPhaseRef.current === 'voting_question' && newPhase && newPhase !== 'ended') {
          const chosen = updated.game_state?.current_question
          if (chosen) {
            const idx = myVoteIndexRef.current
            const wasYours = idx !== null
              ? (updated.game_state?.candidates ?? [])[idx]?.id === chosen.id
              : null
            if (revealTimerRef.current) clearTimeout(revealTimerRef.current)
            setRevealInfo({ question: chosen, wasYours })
            revealTimerRef.current = setTimeout(() => {
              setRevealInfo(null)
              myVoteIndexRef.current = null
            }, 2500)
          }
        }
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
          if (payload.round !== gs.round) return
          setVoteCount(payload.count as number)
          // If this client is the elected advancer and the broadcast indicates
          // the threshold has been reached, trigger resolution. This covers the
          // case where the last voter is NOT the advancer (they already sent the
          // broadcast but skipped resolution because !isAdvancer in submitVote).
          if (!isAdvancerRef.current) return
          const threshold = gs.vote_round_player_count || playersRef.current.length
          if (payload.count < threshold) return
          if (gs.phase === 'round_c_choice') {
            void resolveTypeCChoiceRef.current()
          } else {
            const vt = voteTypeForPhase(gs.phase)
            if (vt) void resolveVotesRef.current(vt)
          }
        })
        .on('broadcast', { event: 'phase_changed' }, () => {
          // Someone advanced the game — pull the fresh state from the DB.
          refetchRoom()
        })
        .on('broadcast', { event: 'player_joined' }, ({ payload }) => {
          if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
          setToastMessage(fr.game.player_joined(payload.pseudo as string))
          toastTimerRef.current = setTimeout(() => setToastMessage(null), 2500)
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
        const joined = payload.new as Player
        // Was this a genuinely new row? (Read the synced ref BEFORE the update.)
        const isNewJoin = !playersRef.current.some((p) => p.id === joined.id)
        setPlayers((prev) => {
          if (prev.find((p) => p.id === joined.id)) return prev
          const next = [...prev, joined]
          playersRef.current = next
          return next
        })
        // Broadcast the join toast OUTSIDE the state updater (updaters must stay
        // pure — this handler runs on every connected client). Elect a single
        // sender (smallest id present) so one join produces one broadcast, not K.
        if (!isNewJoin) return
        const currentGs = roomRef.current?.game_state
        if (!currentGs || currentGs.phase === 'ended') return
        const ids = playersRef.current.map((p) => p.id).sort()
        if (ids[0] === getPlayerId(code)) {
          voteChannelRef.current?.send({
            type: 'broadcast', event: 'player_joined',
            payload: { pseudo: joined.pseudo },
          })
        }
      })
      .on('postgres_changes', {
        event: 'DELETE', schema: 'public', table: 'players',
      }, (payload) => {
        const leaving = playersRef.current.find((p) => p.id === payload.old.id)
        setPlayers((prev) => {
          const next = prev.filter((p) => p.id !== payload.old.id)
          playersRef.current = next
          return next
        })
        const currentGs = roomRef.current?.game_state
        if (leaving && leaving.id !== getPlayerId(code) && currentGs && currentGs.phase !== 'ended') {
          if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
          setToastMessage(fr.game.player_left(leaving.pseudo))
          toastTimerRef.current = setTimeout(() => setToastMessage(null), 2500)
        }
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
  // Any non-game status ('waiting', legacy 'lobby') bounces back; only
  // 'playing'/'ended' belong on the game page.
  useEffect(() => {
    if (room && room.status !== 'playing' && room.status !== 'ended') {
      router.replace(`/room/${code}/lobby`)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.status])

  // Visitor arrives at /game without a stored player ID (typed URL directly, or
  // after clearing storage) — redirect to join so they can enter a pseudo.
  useEffect(() => {
    if (room && !myId) {
      router.replace('/join?code=' + code)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, myId])

  // Prune ghosts (closed tabs) and keep the room alive while anyone is here.
  useRoomPresence(room?.id ?? null, myId)

  // When the roster shrinks mid-vote (a ghost got pruned), the host re-checks the
  // real vote count and advances if everyone still present has already voted.
  const resolveOnShrinkRef = useRef<() => void>(() => {})
  const prevPlayerLenRef = useRef(0)
  useEffect(() => {
    if (players.length > 0 && players.length < prevPlayerLenRef.current) {
      resolveOnShrinkRef.current()
    }
    prevPlayerLenRef.current = players.length
  }, [players.length])

  // SC-5 robustness: lazily stamp round_started_at for pre-Phase-3 in-flight rows
  // whose game_state was written before the round_started_at field was introduced.
  // Only the elected advancer (smallest player id present) writes, at most once per mount.
  const lazyStampedRef = useRef(false)
  const gs_phase = room?.game_state?.phase
  const gs_started_at = room?.game_state?.round_started_at
  useEffect(() => {
    if (lazyStampedRef.current) return
    const r = roomRef.current
    const gs = r?.game_state
    if (!gs || !r) return
    const timerPhases = ['voting_question', 'round_a_vote', 'round_b_vote', 'round_c_choice']
    if (!timerPhases.includes(gs.phase)) return
    if (gs.round_started_at) return // already stamped
    // Only the advancer writes to avoid simultaneous writes.
    const sortedIds = [...playersRef.current].map((p) => p.id).sort()
    const advancerId = sortedIds[0] ?? null
    if (!myId || advancerId !== myId) return
    lazyStampedRef.current = true
    updateRoomGameState(r.id, { ...gs, round_started_at: new Date().toISOString() })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gs_phase, gs_started_at])

  if (!room || !myId) return <LoadingScreen />
  const gs = room.game_state
  if (!gs) return <LoadingScreen />

  const me = players.find((p) => p.id === myId)
  const isHost = me?.is_host ?? false
  // Single deterministic advancer (smallest player id) fires the round-end timer.
  const advancerId = players.length ? [...players].map((p) => p.id).sort()[0] : null
  const isAdvancer = advancerId === myId
  // Keep the ref in sync so broadcast handlers always see the current value.
  isAdvancerRef.current = isAdvancer

  // Write the new game state, then broadcast so every client re-fetches it —
  // this is the reliable convergence path, independent of postgres_changes.
  // Reads roomRef (not closed-over 'room') so it is safe to call from the
  // broadcast handler, which captures this function from the first render
  // where 'room' state was still null.
  async function advance(next: GameState) {
    const r = roomRef.current
    if (!r) return
    await updateRoomGameState(r.id, next)
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

    const threshold = gs!.vote_round_player_count || players.length
    // Only the elected advancer resolves — prevents every client that sees the
    // threshold being met from racing to call resolveVotes with independent Math.random().
    if (count >= threshold && isAdvancer) await resolveVotes(voteType)
  }

  async function resolveVotes(voteType: string) {
    // Read from ref so this is safe when called from the broadcast handler,
    // which closes over this function from the first render where 'room'/'gs'
    // state were still null (stale closure / temporal dead zone problem).
    const r = roomRef.current
    const rgs = r?.game_state
    if (!r || !rgs) return
    if (resolvingRef.current) return
    resolvingRef.current = true
    try {
      const votes = await fetchVotes(r.id, rgs.round, voteType)

      if (voteType === 'question_selection') {
        const winnerIndex = tallyQuestionSelection(votes)
        const chosen = rgs.candidates[winnerIndex] ?? rgs.candidates[0]
        const nextPhase = chosen.type === 'A' ? 'round_a_vote' : chosen.type === 'B' ? 'round_b_vote' : 'round_c_choice'
        await advance({
          ...rgs, phase: nextPhase as GameState['phase'],
          current_question: chosen, played_question_ids: [...rgs.played_question_ids, chosen.id],
          round_started_at: new Date().toISOString(), vote_round_player_count: playersRef.current.length,
        })
        return
      }

      if (voteType === 'designation') {
        const frozenCount02 = rgs.vote_round_player_count || playersRef.current.length
        const { topIds, tieAll } = tallyDesignation(votes, frozenCount02)
        await advance({
          ...rgs,
          phase: 'round_a_reveal',
          designated_player_ids: topIds,
          designation_tie_all: tieAll,
        })
        return
      }

      if (voteType === 'confession') {
        const yesVotes = votes.filter((v) => v.answer === true)
        const denom = rgs.vote_round_player_count || playersRef.current.length
        const pct = denom > 0 ? Math.round((yesVotes.length / denom) * 100) : 0
        const yesIds = yesVotes.map((v) => v.player_id as string)
        const winner = yesIds.length > 0 && pct < 100
          ? yesIds[Math.floor(Math.random() * yesIds.length)]
          : null
        await advance({
          ...rgs, phase: 'round_b2_roulette', b_subtype: 'B2',
          revealed_player_ids: yesIds,
          designated_player_id: winner, yes_percentage: pct,
        })
      }
    } finally {
      resolvingRef.current = false
    }
  }

  // Type C — a player either volunteers or designates someone. Both count toward
  // the same "everyone acted" threshold; resolution prefers volunteers.
  async function submitChoice(voteData: Record<string, unknown>, voteType: 'volunteer' | 'designation') {
    if (!room || !gs || hasVoted) return
    setHasVoted(true)

    const { error } = await supabase.from('votes').insert({
      room_id: room.id, round: gs.round, player_id: myId, vote_type: voteType, ...voteData,
    })
    if (error) {
      console.error('[choice vote]', error)
      setHasVoted(false)
      return
    }

    const count = await countChoiceVotes(room.id, gs.round)
    setVoteCount(count)
    await voteChannelRef.current?.send({
      type: 'broadcast', event: 'vote_count', payload: { count, round: gs.round },
    })

    const threshold = gs!.vote_round_player_count || players.length
    // Only the elected advancer resolves (same guard as submitVote).
    if (count >= threshold && isAdvancer) await resolveTypeCChoice()
  }

  async function resolveTypeCChoice() {
    const r = roomRef.current
    const rgs = r?.game_state
    if (!r || !rgs) return
    if (resolvingRef.current) return
    resolvingRef.current = true
    try {
      const vols = await fetchVotes(r.id, rgs.round, 'volunteer')
      if (vols.length > 0) {
        await advance({
          ...rgs, phase: 'round_c_volunteers_reveal',
          volunteer_player_ids: vols.map((v) => v.player_id as string),
        })
        return
      }
      const desigs = await fetchVotes(r.id, rgs.round, 'designation')
      const frozenCountC = rgs.vote_round_player_count || playersRef.current.length
      const { topIds } = tallyDesignation(desigs, frozenCountC)
      const pool = topIds.length > 0 ? topIds : playersRef.current.map((p) => p.id)
      const winner = pool[Math.floor(Math.random() * pool.length)] ?? null
      await advance({
        ...rgs, phase: 'round_c_roulette',
        designated_player_ids: pool, designated_player_id: winner,
      })
    } finally {
      resolvingRef.current = false
    }
  }

  // Keep the broadcast handler's resolve calls pointing at the current render.
  resolveVotesRef.current = resolveVotes
  resolveTypeCChoiceRef.current = resolveTypeCChoice

  // Pause / resume: use roomRef to get the freshest game_state and avoid stale
  // closure issues when the DB was updated between renders.
  async function onPause() {
    const r = roomRef.current
    if (!r?.game_state) return
    await advance({ ...r.game_state, paused: true })
  }

  async function onResume() {
    const r = roomRef.current
    if (!r?.game_state) return
    await advance({ ...r.game_state, paused: false })
  }

  async function onRevealB2() {
    if (!room || !gs) return
    await advance({ ...gs, b2_revealed: true })
  }

  async function onNextRound() {
    if (!room || !gs) return
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
      revealed_player_ids: [], yes_percentage: null, volunteer_player_ids: [],
      b2_revealed: false, stats,
      round_started_at: new Date().toISOString(), vote_round_player_count: playersRef.current.length,
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

    // Deliberate leave → forget our identity so we don't try to reconnect to a
    // deleted row later.
    clearPlayerId(code)
    await supabase.from('players').delete().eq('id', myId)

    const { data: rest } = await supabase.from('players').select().eq('room_id', room.id)
    const remaining = (rest ?? []) as Player[]

    if (remaining.length === 0) {
      await supabase.from('rooms').delete().eq('id', room.id)
    } else if (wasHost) {
      // Promote the earliest joiner among those left (the one who joined right after).
      const next = [...remaining].sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''))[0]
      // TOCTOU guard: verify the intended next host still exists before the update.
      // If they quit concurrently and their row was already deleted, re-read and
      // pick whoever is still present.
      const { data: updated } = await supabase.from('players').update({ is_host: true }).eq('id', next.id).select().single()
      if (!updated) {
        // next host was deleted between our read and our write — re-read and retry.
        const { data: fresh } = await supabase.from('players').select().eq('room_id', room.id)
        const freshRemaining = (fresh ?? []) as Player[]
        if (freshRemaining.length > 0) {
          const fallback = [...freshRemaining].sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''))[0]
          await supabase.from('players').update({ is_host: true }).eq('id', fallback.id)
        }
      }
    }

    router.push('/')
  }

  // Host-only: re-evaluate resolution after the roster shrinks (ghost pruned).
  resolveOnShrinkRef.current = () => {
    if (!isHost || !room) return
    const isChoice = gs.phase === 'round_c_choice'
    const vt = voteTypeForPhase(gs.phase)
    if ((!vt && !isChoice) || players.length === 0) return
    void (async () => {
      const count = isChoice
        ? await countChoiceVotes(room.id, gs.round)
        : await countVotes(room.id, gs.round, vt as string)
      if (count >= (gs.vote_round_player_count || players.length)) {
        if (isChoice) await resolveTypeCChoice()
        else await resolveVotes(vt as string)
      }
    })()
  }

  // Quit handler with confirm — passed into RoundHeader via context.
  const handleQuit = () => {
    if (typeof window === 'undefined' || window.confirm(fr.game.quit_confirm)) onQuit()
  }

  if (gs.paused) return <PausedScreen isHost={isHost} onResume={onResume} onStop={returnToLobby} />

  if (revealInfo) return <QuestionRevealScreen question={revealInfo.question} wasYours={revealInfo.wasYours} />

  const nextLabel = gs.round >= MAX_ROUNDS ? fr.game.see_results : fr.game.next_round

  const screen = (() => {
    switch (gs.phase) {
      case 'voting_question':
        return <QuestionSelectionScreen gs={gs} isHost={isHost} isAdvancer={isAdvancer} hasVoted={hasVoted} voteCount={voteCount} playerCount={players.length} onVote={(i) => { myVoteIndexRef.current = i; submitVote({ question_index: i }, 'question_selection') }} onForce={() => resolveVotes('question_selection')} />
      case 'round_a_vote':
        return <DesignationVoteScreen gs={gs} players={players} myId={myId} isHost={isHost} isAdvancer={isAdvancer} hasVoted={hasVoted} voteCount={voteCount} accent={C.a} onVote={(id) => submitVote({ target_player_id: id }, 'designation')} onForce={() => resolveVotes('designation')} />
      case 'round_a_reveal':
        return <DesignationRevealScreen gs={gs} players={players} isHost={isHost} accent={C.a} nextLabel={nextLabel} onNext={onNextRound} onEnd={onEndGame} />
      case 'round_b_vote':
        return <ConfessionVoteScreen gs={gs} players={players} isHost={isHost} isAdvancer={isAdvancer} hasVoted={hasVoted} voteCount={voteCount} onVote={(a) => submitVote({ answer: a }, 'confession')} onForce={() => resolveVotes('confession')} />
      case 'round_b2_roulette':
        return <B2RouletteScreen gs={gs} players={players} isHost={isHost} nextLabel={nextLabel} onReveal={onRevealB2} onNext={onNextRound} onEnd={onEndGame} />
      case 'round_c_choice':
        return <ChoiceScreen gs={gs} players={players} myId={myId} isHost={isHost} isAdvancer={isAdvancer} hasVoted={hasVoted} voteCount={voteCount} onVolunteer={() => submitChoice({}, 'volunteer')} onDesignate={(id) => submitChoice({ target_player_id: id }, 'designation')} onForce={resolveTypeCChoice} />
      case 'round_c_volunteers_reveal':
        return <VolunteersRevealScreen gs={gs} players={players} isHost={isHost} nextLabel={nextLabel} onNext={onNextRound} onEnd={onEndGame} />
      case 'round_c_roulette':
        return <CRouletteScreen gs={gs} players={players} isHost={isHost} nextLabel={nextLabel} onNext={onNextRound} onEnd={onEndGame} />
      case 'ended':
        return <EndScreen gs={gs} players={players} myId={myId} isHost={isHost} theme={room.theme} onNewRound={returnToLobby} onLeave={onQuit} />
      default:
        return <LoadingScreen />
    }
  })()

  // Only provide controls for phases that show a RoundHeader (not 'ended').
  // EndScreen has its own footer actions; 'ended' screens don't show quit/pause.
  const controls = gs.phase !== 'ended' ? { onQuit: handleQuit, onPause } : null
  return (
    <GameControlsCtx.Provider value={controls}>
      {screen}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)',
            zIndex: 50, background: C.surface, border: `1px solid ${C.border}`,
            borderRadius: 24, padding: '8px 16px', maxWidth: 280,
            color: '#fff', fontSize: 14, fontWeight: 500, fontFamily: 'var(--font-body)',
          }}
        >
          {toastMessage}
        </div>
      )}
    </GameControlsCtx.Provider>
  )
}
