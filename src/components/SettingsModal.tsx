import { useEffect, useState, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useThemeStore } from '../store/themeStore'
import { DIFFICULTY_CONFIG, getDifficultyLabel } from '../config/difficultyConfig'
import { TILE_COLORS, BOARD_BG, C } from '../theme/tokens'
import { Tile } from './Tile'
import { SegmentedControl } from './SegmentedControl'
import { SelectionBox, SelectionBoxHandle } from './SelectionBox'
import { ParticleLayer } from './ParticleLayer'
import { useDragSelect } from '../hooks/useDragSelect'
import { normalizeRect, sumRect, isValidSelection, clearRect } from '../utils/gameLogic'
import { Board, SelectionRect, Particle, SliceAnimation } from '../types/game'
import { buildParticles } from '../store/gameStore'
import { useAuthStore } from '../store/authStore'
import { generateBoardWithSize } from '../utils/boardGenerator'
import { playPopSound, playSwordSlashSound } from '../utils/sound'
import { SliceLayer } from './SliceLayer'
import { useIsPortrait } from '../hooks/useIsPortrait'

const PREVIEW_COLS = 6
const PREVIEW_ROWS = 10
const TILE_S = 52
const GAP_S = 2
const CELL_S = TILE_S + GAP_S
const PREVIEW_W = PREVIEW_COLS * CELL_S - GAP_S
const PREVIEW_H = PREVIEW_ROWS * CELL_S - GAP_S

function generatePreviewBoard(): Board {
  return generateBoardWithSize(PREVIEW_ROWS, PREVIEW_COLS)
}

interface Props { onClose: () => void }

export function SettingsModal({ onClose }: Props) {
  const {
    theme,
    tileShape,
    tileColorId,
    showHintCount,
    showDifficulty,
    soloBoardDifficulty,
    showDragSelectionSum,
    showDragSelectionRangeColor,
    devMode,
    soundEnabled,
    clearEffect,
    setTheme,
    setTileShape,
    setTileColor,
    setShowHintCount,
    setShowDifficulty,
    setSoloBoardDifficulty,
    setShowDragSelectionSum,
    setShowDragSelectionRangeColor,
    setDevMode,
    setSoundEnabled,
    setClearEffect,
  } = useThemeStore()

  const { user } = useAuthStore()
  const { isPortrait } = useIsPortrait()
  const [settingsTab, setSettingsTab] = useState<'decor' | 'feature' | 'dev'>('decor')
  const [previewBoard, setPreviewBoard] = useState<Board>(generatePreviewBoard)
  const [previewParticles, setPreviewParticles] = useState<Particle[]>([])
  const [previewSlices, setPreviewSlices] = useState<SliceAnimation[]>([])
  const previewRef = useRef<HTMLDivElement>(null)
  const selRef = useRef<SelectionBoxHandle>(null)

  const resetPreviewBoard = useCallback(() => {
    selRef.current?.hide()
    setPreviewParticles([])
    setPreviewSlices([])
    setPreviewBoard(generatePreviewBoard())
  }, [])

  useEffect(() => {
    const nulls = previewBoard.flat().filter(v => v === null).length
    if (nulls >= Math.floor(PREVIEW_COLS * PREVIEW_ROWS / 2)) {
      resetPreviewBoard()
    }
  }, [previewBoard, resetPreviewBoard])

  const onPreviewDrag = useCallback((rect: SelectionRect) => {
    selRef.current?.show(normalizeRect(rect), sumRect(previewBoard, rect))
  }, [previewBoard])

  const onPreviewCommit = useCallback((rect: SelectionRect) => {
    selRef.current?.hide()
    if (!isValidSelection(previewBoard, rect)) return
    const { newBoard, cleared } = clearRect(previewBoard, rect)
    setPreviewBoard(newBoard as Board)

    const count = cleared.length
    const tier = (count >= 4 ? 'big' : count >= 3 ? 'combo' : 'normal') as 'big' | 'combo' | 'normal'

    if (clearEffect === 'sword') {
      if (soundEnabled) playSwordSlashSound(tier as 'big' | 'combo' | 'normal')
      const ts = Date.now()
      const newSlices: SliceAnimation[] = cleared.map((cell, i) => ({
        id: `preview-slice-${ts}-${i}`,
        row: cell.row,
        col: cell.col,
        value: cell.value,
      }))
      setPreviewSlices(prev => [...prev, ...newSlices])
      setTimeout(() => {
        setPreviewSlices(prev => prev.filter(s => !newSlices.some(ns => ns.id === s.id)))
      }, 600)
    } else {
      const [particles, duration] = buildParticles(cleared, false)
      const particleTier = particles[0]?.tier
      if (soundEnabled && particleTier) playPopSound(particleTier)
      setPreviewParticles(prev => [...prev, ...particles])
      setTimeout(() => {
        setPreviewParticles(prev => prev.filter(p => !particles.some(np => np.id === p.id)))
      }, duration + 400)
    }
  }, [previewBoard, soundEnabled, clearEffect])

  const onPreviewCancel = useCallback(() => selRef.current?.hide(), [])

  const { handleTouchStart, handleTouchMove, handleTouchEnd } = useDragSelect(
    previewRef,
    { onDrag: onPreviewDrag, onCommit: onPreviewCommit, onCancel: onPreviewCancel },
    () => 'playing',
    PREVIEW_COLS,
    PREVIEW_ROWS,
    { requireStartInside: true },
  )

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  useEffect(() => {
    if (!user && settingsTab === 'dev') {
      setSettingsTab('decor')
    }
  }, [user, settingsTab])

  const difficultyLabel = getDifficultyLabel(soloBoardDifficulty)
  const settingsTabOptions = [
    { value: 'decor', label: '🎨 꾸미기' },
    { value: 'feature', label: '⚙️ 기능' },
    ...(user ? [{ value: 'dev', label: '🛠️ 개발' }] : []),
  ]

  const settingsContent = (
    <div className="flex flex-col gap-5">
      {/* 탭 스위치 */}
      <SegmentedControl
        options={settingsTabOptions}
        value={settingsTab}
        onChange={v => setSettingsTab(v as 'decor' | 'feature' | 'dev')}
      />
      <div className={`flex-1 border-t ${theme === 'light' ? 'border-gray-200' : 'border-gray-700'}`} />

      {settingsTab === 'decor' && <>
        <div>
          <div className="text-xs text-gray-400 uppercase tracking-widest font-semibold mb-2">테마</div>
          <SegmentedControl
            options={[
              { value: 'light', label: '☀️ 라이트' },
              { value: 'dark',  label: '🌙 다크' }
            ]}
            value={theme}
            onChange={setTheme}
          />
        </div>

        <div>
          <div className="text-xs text-gray-400 uppercase tracking-widest font-semibold mb-2">타일 모양</div>
          <SegmentedControl
            options={[
              { value: 'apple',  label: '🍎 사과' },
              { value: 'circle', label: '🔴 원형' },
              { value: 'square', label: '🟥 사각형' },
              { value: '8bit',   label: '🛑 8BIT' },
            ]}
            value={tileShape}
            onChange={setTileShape}
          />
        </div>

        <div>
          <div className="text-xs text-gray-400 uppercase tracking-widest font-semibold mb-2">타일 색상</div>
          <div className="flex gap-2">
            {TILE_COLORS.map(color => (
              <button
                key={color.id}
                onClick={() => setTileColor(color.id)}
                title={color.label}
                className="flex-1 aspect-square rounded-xl transition-all active:scale-90"
                style={{
                  background: color.fill,
                  outline: tileColorId === color.id ? `2px solid ${color.fill}` : 'none',
                  outlineOffset: 2,
                  height: 40,
                }}
              />
            ))}
          </div>
        </div>

        <div>
          <div className="text-xs text-gray-400 uppercase tracking-widest font-semibold mb-2">타일 제거 이펙트</div>
          <SegmentedControl
            options={[
              { value: 'particles', label: '✨ 파티클' },
              { value: 'sword',     label: '⚔️ 칼 베기' },
            ]}
            value={clearEffect}
            onChange={v => setClearEffect(v as 'particles' | 'sword')}
          />
        </div>
      </>}

      {settingsTab === 'feature' && <>
        <div>
          <div className="text-xs text-gray-400 uppercase tracking-widest font-semibold mb-2">효과음</div>
          <SegmentedControl
            options={[
              { value: 'on',  label: '🔊 켜기' },
              { value: 'off', label: '🔇 끄기' },
            ]}
            value={soundEnabled ? 'on' : 'off'}
            onChange={v => setSoundEnabled(v === 'on')}
          />
        </div>

        <div>
          <div className="text-xs text-gray-400 uppercase tracking-widest font-semibold mb-2">드래그 선택 합계 표시</div>
          <SegmentedControl
            options={[
              { value: 'on',  label: '✅ 켜기' },
              { value: 'off', label: '❌ 끄기' },
            ]}
            value={showDragSelectionSum ? 'on' : 'off'}
            onChange={v => setShowDragSelectionSum(v === 'on')}
          />
        </div>

        <div>
          <div className="text-xs text-gray-400 uppercase tracking-widest font-semibold mb-2">드래그 범위별 박스 색상</div>
          <SegmentedControl
            options={[
              { value: 'on',  label: '✅ 켜기' },
              { value: 'off', label: '❌ 끄기' },
            ]}
            value={showDragSelectionRangeColor ? 'on' : 'off'}
            onChange={v => setShowDragSelectionRangeColor(v === 'on')}
          />
        </div>

        <div>
          <div className="text-xs text-gray-400 uppercase tracking-widest font-semibold mb-2">게임 중 조합 수 표시</div>
          <SegmentedControl
            options={[
              { value: 'on',  label: '✅ 켜기' },
              { value: 'off', label: '❌ 끄기' },
            ]}
            value={showHintCount ? 'on' : 'off'}
            onChange={v => setShowHintCount(v === 'on')}
          />
        </div>

        <div>
          <div className="text-xs text-gray-400 uppercase tracking-widest font-semibold mb-2">게임 중 난이도 표시</div>
          <SegmentedControl
            options={[
              { value: 'on',  label: '✅ 켜기' },
              { value: 'off', label: '❌ 끄기' },
            ]}
            value={showDifficulty ? 'on' : 'off'}
            onChange={v => setShowDifficulty(v === 'on')}
          />
        </div>
      </>}

      {settingsTab === 'dev' && user && <>
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs text-gray-400 uppercase tracking-widest font-semibold">싱글 게임 난이도</div>
            <div className="text-sm font-semibold" style={{ color: C.textPrimary }}>{difficultyLabel}</div>
          </div>

          <div className="mb-3">
            <SegmentedControl
              options={[
                { value: 'random' as const, label: '🎲 랜덤' },
                { value: 'fixed' as const, label: '⭐️ 직접 설정' }
              ]}
              value={soloBoardDifficulty === DIFFICULTY_CONFIG.RANDOM ? 'random' : 'fixed'}
              onChange={(v) => {
                if (v === 'random') {
                  setSoloBoardDifficulty(DIFFICULTY_CONFIG.RANDOM)
                } else {
                  setSoloBoardDifficulty(DIFFICULTY_CONFIG.DEFAULT)
                }
              }}
            />
          </div>

          {soloBoardDifficulty !== DIFFICULTY_CONFIG.RANDOM && (
            <>
              <input
                type="range"
                min={DIFFICULTY_CONFIG.MIN}
                max={DIFFICULTY_CONFIG.MAX}
                step={1}
                value={soloBoardDifficulty}
                onChange={e => setSoloBoardDifficulty(Number(e.target.value))}
                className="themed-slider w-full"
                style={{ '--slider-pct': ((soloBoardDifficulty - DIFFICULTY_CONFIG.MIN) / (DIFFICULTY_CONFIG.MAX - DIFFICULTY_CONFIG.MIN)) * 100 } as React.CSSProperties}
              />
              <div className="mt-1 flex justify-between text-[11px]" style={{ color: C.textMuted, fontVariantNumeric: 'tabular-nums', paddingLeft: '6px', paddingRight: '6px' }}>
                {[1, 2, 3, 4, 5].map(n => (
                  <span key={n}>{n}</span>
                ))}
              </div>
            </>
          )}
        </div>

        <div>
          <div className="text-xs text-gray-400 uppercase tracking-widest font-semibold mb-2">개발자 모드</div>
          <SegmentedControl
            options={[
              { value: 'on', label: '✅ 켜기' },
              { value: 'off', label: '❌ 끄기' },
            ]}
            value={devMode ? 'on' : 'off'}
            onChange={v => setDevMode(v === 'on')}
          />
          <div className="mt-1.5 text-[11px]" style={{ color: C.textMuted }}>
            AI 데모 / 보드 내보내기 등 개발&디버그 기능을 활성화합니다.
          </div>
        </div>
      </>}
    </div>
  )

  const previewPanel = (
    <div className="shrink-0">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs text-gray-400 uppercase tracking-widest font-semibold">미리보기 (직접 드래그해보세요)</div>
        <button
          onClick={resetPreviewBoard}
          className="rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all active:scale-95"
          style={{
            color: C.textSub,
            background: C.surfaceRaised,
            border: `1px solid ${C.borderFaint}`,
          }}
        >
          초기화
        </button>
      </div>
      <div
        ref={previewRef}
        style={{
          width: PREVIEW_W,
          height: PREVIEW_H,
          borderRadius: 12,
          background: BOARD_BG[theme].background,
          border: BOARD_BG[theme].border,
          display: 'grid',
          gridTemplateColumns: `repeat(${PREVIEW_COLS}, ${TILE_S}px)`,
          gridTemplateRows: `repeat(${PREVIEW_ROWS}, ${TILE_S}px)`,
          gap: GAP_S,
          position: 'relative',
          cursor: 'crosshair',
          touchAction: 'none',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {previewBoard.flat().map((v, i) => (
          <Tile key={i} value={v} />
        ))}
        <SelectionBox
          ref={selRef}
          showSum={showDragSelectionSum}
          showRangeColor={showDragSelectionRangeColor}
        />
        <ParticleLayer
          particles={previewParticles}
          scorePopups={[]}
          width={PREVIEW_W}
          height={PREVIEW_H}
          tileSize={TILE_S}
          gap={GAP_S}
        />
        <SliceLayer
          sliceAnimations={previewSlices}
          tileSize={TILE_S}
          gap={GAP_S}
        />
      </div>
    </div>
  )

  return createPortal(
    <div
      className={`fixed inset-0 z-50 ${isPortrait ? 'flex items-end' : 'flex items-center justify-center'}`}
      style={{ background: C.scrim75, backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className={`shadow-2xl ${isPortrait ? 'bottom-sheet-in' : ''}`}
        style={
          isPortrait
            ? {
                width: '100%',
                borderRadius: '20px 20px 0 0',
                padding: '8px 20px 32px',
                maxHeight: '90dvh',
                overflowY: 'auto',
                background: C.surface,
                border: `1px solid ${C.borderStrong}`,
                borderBottom: 'none',
              }
            : {
                maxWidth: 760,
                width: 'calc(100% - 32px)',
                borderRadius: 24,
                padding: 24,
                background: C.surface,
                border: `1px solid ${C.borderStrong}`,
              }
        }
        onClick={e => e.stopPropagation()}
      >
        {/* 바텀시트 핸들 */}
        {isPortrait && (
          <div style={{ width: 36, height: 4, borderRadius: 2, background: C.borderStrong, margin: '8px auto 16px' }} />
        )}

        {/* 헤더 */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold" style={{ color: C.textPrimary }}>⚙️ 설정</h2>
          <button
            onClick={onClose}
            className="text-2xl leading-none transition-all"
            style={{ color: C.textMuted }}
          >
            ✕
          </button>
        </div>

        {/* 바디: 포트레이트는 단일 컬럼, 랜드스케이프는 2열 */}
        {isPortrait ? (
          <div className="flex flex-col gap-5">
            {settingsContent}
          </div>
        ) : (
          <div className="flex gap-8 items-start">
            {previewPanel}
            <div className="flex-1">
              {settingsContent}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
