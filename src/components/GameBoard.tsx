import { useRef, useCallback, useMemo } from 'react'
import { useGameStore } from '../store/gameStore'
import { useThemeStore } from '../store/themeStore'
import { BOARD_BG } from '../theme/tokens'
import { useDragSelect } from '../hooks/useDragSelect'
import { normalizeRect, sumRect } from '../utils/gameLogic'
import { Tile } from './Tile'
import { SelectionBox, SelectionBoxHandle } from './SelectionBox'
import { ParticleLayer } from './ParticleLayer'
import { SliceLayer } from './SliceLayer'
import { COLS, ROWS, SelectionRect } from '../types/game'
import { useIsPortrait } from '../hooks/useIsPortrait'

const DEFAULT_TILE = 52
const GAP = 2

function transposeRect(rect: SelectionRect): SelectionRect {
  return {
    startRow: rect.startCol,
    startCol: rect.startRow,
    endRow: rect.endCol,
    endCol: rect.endRow,
  }
}

export function GameBoard() {
  const boardRef = useRef<HTMLDivElement>(null)
  const selBoxRef = useRef<SelectionBoxHandle>(null)
  const board = useGameStore(state => state.board)
  const gamePhase = useGameStore(s => s.gamePhase)
  const theme = useThemeStore(s => s.theme)
  const showDragSelectionSum = useThemeStore(s => s.showDragSelectionSum)
  const showDragSelectionRangeColor = useThemeStore(s => s.showDragSelectionRangeColor)
  const aiSolving = useGameStore(s => s.aiSolving)
  const hideTiles = gamePhase === 'countdown'

  const { isPortrait, portraitTileSize } = useIsPortrait()

  const tileSize = isPortrait ? portraitTileSize : DEFAULT_TILE
  const gap = GAP
  const cell = tileSize + gap

  // In portrait: 10 tiles across (ROWS), 17 tiles down (COLS)
  // In landscape: 17 tiles across (COLS), 10 tiles down (ROWS)
  const visualCols = isPortrait ? ROWS : COLS
  const visualRows = isPortrait ? COLS : ROWS
  const boardWidth  = visualCols * cell - gap
  const boardHeight = visualRows * cell - gap

  const handleDrag = useCallback((visualRect: SelectionRect) => {
    const currentBoard = useGameStore.getState().board
    // Convert visual rect to logical rect for sum calculation
    const logicalRect = isPortrait ? transposeRect(visualRect) : visualRect
    // Pass visual rect to SelectionBox so pixel positions are correct
    const visualNorm = normalizeRect(visualRect)
    selBoxRef.current?.show(visualNorm, sumRect(currentBoard, logicalRect))
  }, [isPortrait])

  const handleCommit = useCallback((visualRect: SelectionRect) => {
    selBoxRef.current?.hide()
    const logicalRect = isPortrait ? transposeRect(visualRect) : visualRect
    useGameStore.getState().confirmSelection(logicalRect)
  }, [isPortrait])

  const handleCancel = useCallback(() => {
    selBoxRef.current?.hide()
  }, [])

  const { handleTouchStart, handleTouchMove, handleTouchEnd } = useDragSelect(
    boardRef,
    { onDrag: handleDrag, onCommit: handleCommit, onCancel: handleCancel },
    undefined,
    visualCols,
    visualRows,
    {},
    cell,
  )

  // Render tiles in visual order
  // Portrait: visual_row = logical_col (0..16), visual_col = logical_row (0..9)
  // so board[vc][vr] = board[logical_row][logical_col]
  const tiles = useMemo(() => {
    if (hideTiles) return null
    if (isPortrait) {
      return Array.from({ length: COLS }, (_, vr) =>
        Array.from({ length: ROWS }, (_, vc) => (
          <Tile key={`${vr}-${vc}`} value={board[vc][vr]} size={tileSize} />
        ))
      )
    }
    return board.map((row, r) =>
      row.map((v, c) => <Tile key={`${r}-${c}`} value={v} size={tileSize} />)
    )
  }, [board, hideTiles, isPortrait, tileSize])

  return (
    <div className="relative" style={{ width: boardWidth }}>
      <div
        ref={boardRef}
        className="relative select-none"
        style={{
          width: boardWidth,
          height: boardHeight,
          display: 'grid',
          gridTemplateColumns: `repeat(${visualCols}, ${tileSize}px)`,
          gridTemplateRows: `repeat(${visualRows}, ${tileSize}px)`,
          gap,
          cursor: 'crosshair',
          touchAction: 'none',
          background: BOARD_BG[theme].background,
          borderRadius: 16,
        }}
        onTouchStart={aiSolving ? undefined : handleTouchStart}
        onTouchMove={aiSolving ? undefined : handleTouchMove}
        onTouchEnd={aiSolving ? undefined : handleTouchEnd}
      >
        {tiles}

        <SelectionBox
          ref={selBoxRef}
          showSum={showDragSelectionSum}
          showRangeColor={showDragSelectionRangeColor}
          tileSize={tileSize}
          gap={gap}
        />
        <ParticleLayer
          width={boardWidth}
          height={boardHeight}
          tileSize={tileSize}
          gap={gap}
          isPortrait={isPortrait}
        />
        <SliceLayer
          tileSize={tileSize}
          gap={gap}
          isPortrait={isPortrait}
        />
      </div>
    </div>
  )
}
