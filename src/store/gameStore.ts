import { create } from 'zustand'
import {
  Board, GamePhase, GameMode, Particle, ParticleTier, ScorePopup, SliceAnimation,
  SelectionRect, CellRef, GAME_DURATION, TIME_ATTACK_TARGET,
} from '../types/game'
import { PARTICLE_COLORS } from '../theme/tokens'
import { generateBoardForDifficulty, getBoardDifficulty } from '../utils/boardGenerator'
import { isValidSelection, clearRect, hasAnySolution } from '../utils/gameLogic'
import { useThemeStore } from './themeStore'
import { playPopSound, playSwordSlashSound } from '../utils/sound'
import { AI_API_BASE, aiHeaders } from '../lib/aiApi'

const PERSONAL_BEST_KEY = 'personalBestScore'
const TIME_ATTACK_BEST_KEY = 'timeAttackBest'

let _persistBest = false
export function setPersonalBestPersistence(persist: boolean) {
  _persistBest = persist
}

function loadPersonalBest(): number {
  return parseInt(localStorage.getItem(PERSONAL_BEST_KEY) ?? '0', 10)
}

function loadPersonalBestTime(): number {
  return parseInt(localStorage.getItem(TIME_ATTACK_BEST_KEY) ?? '0', 10)
}

function getTier(count: number): ParticleTier {
  if (count >= 4) return 'big'
  if (count >= 3) return 'combo'
  return 'normal'
}

const PARTICLE_CELL      = 54  // TILE_SIZE(52) + GAP(2)
const PARTICLE_TILE_HALF = 26  // TILE_SIZE(52) / 2
const DEG_TO_RAD         = Math.PI / 180

const TIER_CONFIG: Record<ParticleTier, { perTile: number; size: number; baseDist: number; duration: number }> = {
  normal: { perTile: 7,  size: 7,   baseDist: 50,  duration: 600  },
  combo:  { perTile: 9,  size: 8.5, baseDist: 74,  duration: 720  },
  big:    { perTile: 12, size: 10,  baseDist: 98,  duration: 900  },
}

// Small bright sparks that shoot farther and faster (combo/big only)
const SPARKLE_COLORS = ['#FFFFFF', '#FFD700', '#FF8C00'] as const

const TIER_COLORS: Record<ParticleTier, readonly string[]> = PARTICLE_COLORS

// Shared builder — used by both player and opponent so effects are identical
export function buildParticles(cells: CellRef[], isOpponent: boolean): [Particle[], number] {
  const count = cells.length
  const tier = getTier(count)
  const { perTile, size, baseDist, duration } = TIER_CONFIG[tier]
  const colors = TIER_COLORS[tier]
  const ts = Date.now()
  const prefix = isOpponent ? 'op' : 'p'

  const particles: Particle[] = []
  for (const cell of cells) {
    const px = cell.col * PARTICLE_CELL + PARTICLE_TILE_HALF
    const py = cell.row * PARTICLE_CELL + PARTICLE_TILE_HALF
    const angleOffset = Math.random() * (360 / perTile)

    // Main burst
    for (let i = 0; i < perTile; i++) {
      const angle = (i / perTile) * 360 + angleOffset
      const rad = angle * DEG_TO_RAD
      const dist = baseDist * (0.65 + Math.random() * 0.7)
      particles.push({
        id: `${prefix}-${cell.row}-${cell.col}-${i}-${ts}`,
        row: cell.row,
        col: cell.col,
        color: colors[i % colors.length],
        angle,
        size: size * (0.7 + Math.random() * 0.6),
        distance: dist,
        duration,
        tier,
        shape: 'circle',
        delay: Math.random() * 50,
        startTime: ts,
        vx: Math.cos(rad),
        vy: Math.sin(rad),
        px,
        py,
        ...(isOpponent && { isOpponent: true }),
      })
    }

    // Sparkle secondary burst (combo / big only)
    if (tier !== 'normal') {
      const sparkCount = tier === 'big' ? 3 : 2
      const sparkDist = baseDist * 1.25
      const sparkDur  = Math.round(duration * 0.4)
      for (let i = 0; i < sparkCount; i++) {
        const angle = Math.random() * 360
        const rad = angle * DEG_TO_RAD
        particles.push({
          id: `${prefix}-sp-${cell.row}-${cell.col}-${i}-${ts}`,
          row: cell.row,
          col: cell.col,
          color: SPARKLE_COLORS[i % SPARKLE_COLORS.length],
          angle,
          size: tier === 'big' ? 3.5 : 3,
          distance: sparkDist * (0.8 + Math.random() * 0.4),
          duration: sparkDur,
          tier,
          shape: 'circle',
          delay: 25 + Math.random() * 70,
          rotation: 0,
          startTime: ts,
          vx: Math.cos(rad),
          vy: Math.sin(rad),
          px,
          py,
          ...(isOpponent && { isOpponent: true }),
        })
      }
    }
  }

  return [particles, duration]
}

interface GameState {
  board: Board
  score: number
  personalBest: number
  personalBestTime: number  // seconds, 0 = no record
  gamePhase: GamePhase
  gameMode: GameMode
  timeLeft: number
  elapsedTime: number  // seconds, counts up in time attack
  gameStartedAt: number  // Date.now() when playing began
  boardDifficulty: number | null
  particles: Particle[]
  scorePopups: ScorePopup[]
  sliceAnimations: SliceAnimation[]
  isNewRecord: boolean

  startGame: () => void
  startScoreAttack: () => void
  startTimeAttack: () => void
  beginPlaying: () => void
  syncTime: () => void
  endGame: () => void
  goHome: () => void
  resetPersonalBest: () => void
  setPersonalBest: (score: number) => void
  setPersonalBestTime: (t: number) => void
  confirmSelection: (rect: SelectionRect) => void
  spawnParticles: (cells: CellRef[]) => void
  spawnOpponentParticles: (cells: CellRef[]) => void
  tick: () => void
  aiSolving: boolean
  aiWaiting: boolean  // 서버 응답 대기 중 (모델 다운로드 포함)
  aiMoveProgress: { current: number; total: number } | null
  isAIGame: boolean
  runAISolver: (modelPath: string, moveDelayMs?: number) => Promise<void>
  stopAISolver: () => void
}

export const useGameStore = create<GameState>((set, get) => ({
  board: [],
  score: 0,
  aiSolving: false,
  aiWaiting: false,
  aiMoveProgress: null,
  isAIGame: false,
  personalBest: loadPersonalBest(),
  personalBestTime: loadPersonalBestTime(),
  gamePhase: 'start',
  gameMode: 'score',
  timeLeft: GAME_DURATION,
  elapsedTime: 0,
  gameStartedAt: 0,
  boardDifficulty: null,
  particles: [],
  scorePopups: [],
  sliceAnimations: [],
  isNewRecord: false,

  startGame: () => {
    set({ gamePhase: 'countdown', aiSolving: false, aiWaiting: false, aiMoveProgress: null, isAIGame: false })
  },

  startScoreAttack: () => {
    set({ gameMode: 'score', gamePhase: 'countdown' })
  },

  startTimeAttack: () => {
    set({ gameMode: 'time', gamePhase: 'countdown' })
  },

  beginPlaying: () => {
    const targetDifficulty = useThemeStore.getState().soloBoardDifficulty
    const board = generateBoardForDifficulty(targetDifficulty)
    const boardDifficulty = getBoardDifficulty(board)
    set({
      board,
      score: 0,
      timeLeft: GAME_DURATION,
      elapsedTime: 0,
      gameStartedAt: Date.now(),
      boardDifficulty,
      particles: [],
      scorePopups: [],
      sliceAnimations: [],
      gamePhase: 'playing',
      isNewRecord: false,
      isAIGame: false,
    })
  },

  syncTime: () => {
    const { gameStartedAt, gameMode, gamePhase } = get()
    if (gamePhase !== 'playing' || !gameStartedAt) return
    const elapsed = Math.floor((Date.now() - gameStartedAt) / 1000)
    if (gameMode === 'score') {
      const newTimeLeft = Math.max(0, GAME_DURATION - elapsed)
      if (newTimeLeft <= 0) get().endGame()
      else set({ timeLeft: newTimeLeft })
    } else {
      set({ elapsedTime: elapsed })
    }
  },

  goHome: () => {
    set({ gamePhase: 'start', boardDifficulty: null, particles: [], scorePopups: [], sliceAnimations: [], aiSolving: false, aiWaiting: false, aiMoveProgress: null, isAIGame: false })
  },

  endGame: () => {
    const { score, personalBest, personalBestTime, elapsedTime, gameMode } = get()
    if (gameMode === 'score') {
      const isNewRecord = score > personalBest
      if (isNewRecord && _persistBest) {
        localStorage.setItem(PERSONAL_BEST_KEY, String(score))
      }
      set({
        gamePhase: 'ended',
        personalBest: isNewRecord ? score : personalBest,
        isNewRecord,
        aiSolving: false,
      })
    } else {
      const isNewRecord = personalBestTime === 0 || elapsedTime < personalBestTime
      if (isNewRecord && _persistBest) {
        localStorage.setItem(TIME_ATTACK_BEST_KEY, String(elapsedTime))
      }
      set({
        gamePhase: 'ended',
        personalBestTime: isNewRecord ? elapsedTime : personalBestTime,
        isNewRecord,
        aiSolving: false,
      })
    }
  },

  resetPersonalBest: () => {
    localStorage.removeItem(PERSONAL_BEST_KEY)
    localStorage.removeItem(TIME_ATTACK_BEST_KEY)
    set({ personalBest: 0, personalBestTime: 0 })
  },

  setPersonalBest: (score: number) => {
    localStorage.setItem(PERSONAL_BEST_KEY, String(score))
    set({ personalBest: score })
  },

  setPersonalBestTime: (t: number) => {
    localStorage.setItem(TIME_ATTACK_BEST_KEY, String(t))
    set({ personalBestTime: t })
  },

  confirmSelection: (rect: SelectionRect) => {
    const { board, score, gameMode } = get()
    if (!isValidSelection(board, rect)) return
    const { newBoard, cleared } = clearRect(board, rect)

    const count = cleared.length
    const tier = getTier(count)
    const themeState = useThemeStore.getState()
    const { soundEnabled, clearEffect } = themeState

    if (soundEnabled) {
      if (clearEffect === 'sword') playSwordSlashSound(tier)
      else playPopSound(tier)
    }

    const ts = Date.now()
    const newScore = score + count

    // 공통: combo/big 스코어 팝업
    const newPopups: ScorePopup[] = []
    if (tier !== 'normal') {
      const rows = cleared.map(c => c.row)
      const cols = cleared.map(c => c.col)
      newPopups.push({
        id: `popup-${ts}`,
        count,
        centerRow: (Math.min(...rows) + Math.max(...rows)) / 2,
        centerCol: (Math.min(...cols) + Math.max(...cols)) / 2,
        tier: tier === 'big' ? 'big' : 'combo',
      })
    }

    if (clearEffect === 'sword') {
      // 칼 이펙트: 타일 슬라이스 애니메이션
      const newSlices: SliceAnimation[] = cleared.map((cell, i) => ({
        id: `slice-${ts}-${i}`,
        row: cell.row,
        col: cell.col,
        value: cell.value,
      }))
      set(state => ({
        score: newScore,
        sliceAnimations: [...state.sliceAnimations, ...newSlices],
        scorePopups: [...state.scorePopups, ...newPopups],
      }))
      setTimeout(() => {
        const ids = new Set(newSlices.map(s => s.id))
        const popupIds = new Set(newPopups.map(p => p.id))
        set(state => ({
          sliceAnimations: state.sliceAnimations.filter(s => !ids.has(s.id)),
          scorePopups: state.scorePopups.filter(p => !popupIds.has(p.id)),
        }))
      }, 600)
    } else {
      // 파티클 이펙트
      const [newParticles, duration] = buildParticles(cleared, false)
      set(state => ({
        score: newScore,
        particles: [...state.particles, ...newParticles],
        scorePopups: [...state.scorePopups, ...newPopups],
      }))
      setTimeout(() => {
        const ids = new Set(newParticles.map(p => p.id))
        const popupIds = new Set(newPopups.map(p => p.id))
        set(state => ({
          particles: state.particles.filter(p => !ids.has(p.id)),
          scorePopups: state.scorePopups.filter(p => !popupIds.has(p.id)),
        }))
      }, duration + 400)
    }

    // Phase 2 (next task): board update — heavy 170-tile reconciliation runs after canvas gets first frame
    setTimeout(() => {
      set({ board: newBoard })
      if (gameMode === 'time' && newScore >= TIME_ATTACK_TARGET) {
        get().endGame()
      } else if (!hasAnySolution(newBoard)) {
        get().endGame()
      }
    }, 0)
  },

  spawnParticles: (cells: CellRef[]) => {
    const [newParticles, duration] = buildParticles(cells, false)
    const count = cells.length
    const tier = getTier(count)
    if (useThemeStore.getState().soundEnabled) playPopSound(tier)
    const ts = Date.now()

    const newPopups: ScorePopup[] = []
    if (tier !== 'normal') {
      const rows = cells.map(c => c.row)
      const cols = cells.map(c => c.col)
      newPopups.push({
        id: `popup-${ts}`,
        count,
        centerRow: (Math.min(...rows) + Math.max(...rows)) / 2,
        centerCol: (Math.min(...cols) + Math.max(...cols)) / 2,
        tier: tier === 'big' ? 'big' : 'combo',
      })
    }

    set(state => ({
      particles: [...state.particles, ...newParticles],
      scorePopups: [...state.scorePopups, ...newPopups],
    }))
    setTimeout(() => {
      const ids = new Set(newParticles.map(p => p.id))
      const popupIds = new Set(newPopups.map(p => p.id))
      set(state => ({
        particles: state.particles.filter(p => !ids.has(p.id)),
        scorePopups: state.scorePopups.filter(p => !popupIds.has(p.id)),
      }))
    }, duration + 400)
  },

  spawnOpponentParticles: (cells: CellRef[]) => {
    const [newParticles, duration] = buildParticles(cells, true)
    set(state => ({ particles: [...state.particles, ...newParticles] }))
    setTimeout(() => {
      const ids = new Set(newParticles.map(p => p.id))
      set(state => ({ particles: state.particles.filter(p => !ids.has(p.id)) }))
    }, duration + 200)
  },

  tick: () => { get().syncTime() },

  runAISolver: async (modelPath: string, moveDelayMs = 150) => {
    if (get().aiSolving) return
    if (get().gamePhase !== 'playing') throw new Error('게임을 먼저 시작하세요.')
    set({ aiSolving: true, aiWaiting: true, isAIGame: true, aiMoveProgress: null })

    console.log(`[AI] 서버 요청 시작 — 모델: ${modelPath}`)
    const requestStart = Date.now()

    let moves: SelectionRect[]
    let serverScore: number | undefined
    let serverRemaining: number | undefined
    try {
      const board = get().board
      const numeric = board.map(row => row.map(cell => cell ?? 0))
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 90_000)
      let resp: Response
      try {
        resp = await fetch(`${AI_API_BASE}/solve`, {
          method: 'POST',
          headers: aiHeaders(),
          body: JSON.stringify({ board: numeric, model_path: modelPath }),
          signal: controller.signal,
        })
      } finally {
        clearTimeout(timeout)
      }
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}))
        throw new Error(err.detail ?? `서버 오류 ${resp.status}`)
      }
      const data = await resp.json()
      moves = data.moves as SelectionRect[]
      serverScore = data.score
      serverRemaining = data.remaining
      console.log(`[AI] 서버 응답 — ${((Date.now() - requestStart) / 1000).toFixed(1)}s 소요, ${moves.length}개 수, 예상 점수: ${serverScore}, 예상 잔여: ${serverRemaining}`)
    } catch (e) {
      set({ aiSolving: false, aiWaiting: false, aiMoveProgress: null })
      if ((e as Error).name === 'AbortError') throw new Error('서버 응답 시간 초과 (90초). 모델 다운로드 중일 수 있습니다.')
      throw e
    }

    set({ aiWaiting: false, aiMoveProgress: { current: 0, total: moves.length } })
    console.log(`[AI] 수 재현 시작 — ${moves.length}개`)
    let rejected = 0
    for (let i = 0; i < moves.length; i++) {
      if (!get().aiSolving) break
      set({ aiMoveProgress: { current: i + 1, total: moves.length } })
      await new Promise(r => setTimeout(r, moveDelayMs))
      if (!get().aiSolving) break
      const move = moves[i]
      if (!isValidSelection(get().board, move)) {
        console.warn(`[AI] 수 ${i + 1}/${moves.length} 거부 (보드 불일치):`, move)
        rejected++
        continue
      }
      get().confirmSelection(move)
    }
    console.log(`[AI] 완료 — ${moves.length}개 중 ${moves.length - rejected}개 실행, ${rejected}개 거부`)
    set({ aiSolving: false, aiMoveProgress: null })
  },

  stopAISolver: () => set({ aiSolving: false, aiWaiting: false, aiMoveProgress: null }),

}))
