import { useRef, useEffect } from 'react'
import { useGameStore } from '../store/gameStore'
import { C } from '../theme/tokens'
import { Particle, ScorePopup } from '../types/game'

const TILE_SIZE = 52
const GAP = 2
const CELL = TILE_SIZE + GAP
const COLS = 17
const ROWS = 10
const BOARD_W = COLS * CELL - GAP
const BOARD_H = ROWS * CELL - GAP

const DEG_TO_RAD = Math.PI / 180
const TWO_PI     = Math.PI * 2
const easeOut    = (t: number) => t * (2 - t)

function drawParticles(
  ctx: CanvasRenderingContext2D,
  particles: Particle[],
  now: number,
  width: number,
  height: number,
  cellSize: number,
  tileSize: number,
  isPortrait: boolean,
) {
  ctx.clearRect(0, 0, width, height)
  let currentColor = ''
  for (const p of particles) {
    const elapsed = now - (p.startTime ?? now) - (p.delay ?? 0)
    if (elapsed <= 0) continue
    const progress = elapsed / p.duration
    if (progress >= 1) continue

    const eased    = easeOut(progress)
    const vx = p.vx ?? Math.cos(p.angle * DEG_TO_RAD)
    const vy = p.vy ?? Math.sin(p.angle * DEG_TO_RAD)

    // In portrait mode, swap row↔col for x↔y mapping (logical→visual transposition)
    const originX = isPortrait
      ? p.row * cellSize + tileSize / 2
      : (p.px ?? (p.col * cellSize + tileSize / 2))
    const originY = isPortrait
      ? p.col * cellSize + tileSize / 2
      : (p.py ?? (p.row * cellSize + tileSize / 2))

    const x      = originX + vx * p.distance * eased
    const y      = originY + vy * p.distance * eased
    const radius = (p.size / 2) * (1 - progress)
    if (radius < 0.5) continue

    ctx.globalAlpha = 1 - progress
    if (p.color !== currentColor) {
      ctx.fillStyle = p.color
      currentColor = p.color
    }
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, TWO_PI)
    ctx.fill()
  }
  ctx.globalAlpha = 1
}

interface ParticleLayerProps {
  particles?: Particle[]
  scorePopups?: ScorePopup[]
  width?: number
  height?: number
  tileSize?: number
  gap?: number
  isPortrait?: boolean
}

export function ParticleLayer({
  particles,
  scorePopups,
  width = BOARD_W,
  height = BOARD_H,
  tileSize = TILE_SIZE,
  gap = GAP,
  isPortrait = false,
}: ParticleLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)
  const storeScorePopups = useGameStore(state => state.scorePopups)
  const resolvedScorePopups = scorePopups ?? storeScorePopups
  const cellSize = tileSize + gap

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = height * dpr
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    ctx.scale(dpr, dpr)

    let prevLen = 0
    const loop = () => {
      const activeParticles = particles ?? useGameStore.getState().particles
      const len = activeParticles.length
      if (len > 0) {
        drawParticles(ctx, activeParticles, Date.now(), width, height, cellSize, tileSize, isPortrait)
      } else if (prevLen > 0) {
        ctx.clearRect(0, 0, width, height)
      }
      prevLen = len
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(rafRef.current)
    }
  }, [cellSize, height, particles, tileSize, width, isPortrait])

  return (
    <div
      className="absolute pointer-events-none"
      style={{ inset: 0, zIndex: 20 }}
    >
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          pointerEvents: 'none',
          transform: 'translateZ(0)',
        }}
      />

      {resolvedScorePopups.map(popup => {
        // In portrait mode, visual x = logical row * cell, visual y = logical col * cell
        const cx = isPortrait
          ? popup.centerRow * cellSize + tileSize / 2
          : popup.centerCol * cellSize + tileSize / 2
        const cy = isPortrait
          ? popup.centerCol * cellSize + tileSize / 2
          : popup.centerRow * cellSize + tileSize / 2
        const isBig = popup.tier === 'big'
        return (
          <div
            key={popup.id}
            className={isBig ? 'score-popup-big' : 'score-popup'}
            style={{
              position: 'absolute',
              left: cx,
              top: cy,
              fontSize: isBig ? 34 : 24,
              fontWeight: 900,
              color: isBig ? C.popupBig : C.popupCombo,
              textShadow: isBig
                ? `0 0 12px ${C.popupBig}, 0 0 24px ${C.amber}, 0 2px 6px rgba(0,0,0,0.9)`
                : `0 0 8px ${C.popupCombo}, 0 2px 4px rgba(0,0,0,0.8)`,
              fontFamily: "'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
              whiteSpace: 'nowrap',
            }}
          >
            {isBig ? `🔥 +${popup.count}` : `+${popup.count}`}
          </div>
        )
      })}
    </div>
  )
}
