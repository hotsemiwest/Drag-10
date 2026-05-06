import { useGameStore } from '../store/gameStore'
import { useThemeStore } from '../store/themeStore'
import { TILE_COLORS } from '../theme/tokens'
import { SliceAnimation } from '../types/game'

const TILE_SIZE = 52
const GAP = 2

// 대각 슬래시 기준선: (0, 75%) → (100%, 25%), 기울기 약 -26.6°
const CLIP_TOP    = 'polygon(0 0, 100% 0, 100% 25%, 0 75%)'
const CLIP_BOTTOM = 'polygon(0 75%, 100% 25%, 100% 100%, 0 100%)'
const SLASH_ANGLE = -26.6

interface SliceLayerProps {
  sliceAnimations?: SliceAnimation[]
  tileSize?: number
  gap?: number
  isPortrait?: boolean
}

export function SliceLayer({ sliceAnimations, tileSize = TILE_SIZE, gap = GAP, isPortrait = false }: SliceLayerProps) {
  const storeSliceAnimations = useGameStore(s => s.sliceAnimations)
  const resolved = sliceAnimations ?? storeSliceAnimations
  const tileColorId = useThemeStore(s => s.tileColorId)
  const tileShape   = useThemeStore(s => s.tileShape)

  if (!resolved.length) return null

  const fill = TILE_COLORS.find(c => c.id === tileColorId)?.fill ?? '#e22121'
  const cellSize = tileSize + gap
  const borderRadius =
    tileShape === 'circle' ? '50%' :
    tileShape === '8bit'   ? 0 :
    tileShape === 'apple'  ? '45% 45% 40% 40%' :
    9

  return (
    <div className="absolute pointer-events-none" style={{ inset: 0, zIndex: 25 }}>
      {resolved.map(anim => {
        // In portrait mode, visual x = logical row * cell, visual y = logical col * cell
        const left = isPortrait ? anim.row * cellSize : anim.col * cellSize
        const top  = isPortrait ? anim.col * cellSize : anim.row * cellSize

        const tileContent = (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: fill,
              borderRadius,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'rgba(255,255,255,0.95)',
              fontSize: 22,
              fontWeight: 800,
              fontFamily: "'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
              userSelect: 'none',
            }}
          >
            {anim.value}
          </div>
        )

        return (
          <div key={anim.id} style={{ position: 'absolute', left, top, width: tileSize, height: tileSize }}>
            {/* 위쪽 절반 — 왼쪽 위로 날아감 */}
            <div
              className="slice-top"
              style={{ position: 'absolute', inset: 0, clipPath: CLIP_TOP, overflow: 'hidden' }}
            >
              {tileContent}
            </div>

            {/* 아래쪽 절반 — 오른쪽 아래로 날아감 */}
            <div
              className="slice-bottom"
              style={{ position: 'absolute', inset: 0, clipPath: CLIP_BOTTOM, overflow: 'hidden' }}
            >
              {tileContent}
            </div>

            {/* 슬래시 선 */}
            <div
              className="slice-line"
              style={{
                position: 'absolute',
                left: -4,
                top: '50%',
                width: 'calc(100% + 8px)',
                height: 2,
                marginTop: -1,
                background: 'rgba(255,255,255,0.95)',
                boxShadow: '0 0 6px rgba(255,255,255,0.8), 0 0 14px rgba(255,255,255,0.5)',
                transform: `rotate(${SLASH_ANGLE}deg)`,
                transformOrigin: '4px center',
              }}
            />
          </div>
        )
      })}
    </div>
  )
}
