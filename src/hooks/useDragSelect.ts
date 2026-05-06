import { useRef, useCallback, useEffect } from 'react'
import { SelectionRect, ROWS, COLS } from '../types/game'
import { useGameStore } from '../store/gameStore'

const OUTSIDE_MARGIN = 40

function clampCell(x: number, y: number, boardW: number, boardH: number, cols: number, rows: number, cellPx?: number) {
  const cellW = cellPx ?? boardW / cols
  const cellH = cellPx ?? boardH / rows
  return {
    row: Math.max(0, Math.min(rows - 1, Math.floor(y / cellH))),
    col: Math.max(0, Math.min(cols - 1, Math.floor(x / cellW))),
  }
}

interface CachedRect { left: number; top: number; w: number; h: number }

interface DragCallbacks {
  onDrag: (rect: SelectionRect) => void
  onCommit: (rect: SelectionRect) => void
  onCancel: () => void
}

interface DragSelectOptions {
  requireStartInside?: boolean
}

export function useDragSelect(
  boardRef: React.RefObject<HTMLDivElement | null>,
  { onDrag, onCommit, onCancel }: DragCallbacks,
  getPhase?: () => string,
  gridCols = COLS,
  gridRows = ROWS,
  { requireStartInside = false }: DragSelectOptions = {},
  cellPx?: number,
) {
  const startCell = useRef<{ row: number; col: number } | null>(null)
  const isDragging = useRef(false)
  const currentRect = useRef<SelectionRect | null>(null)
  const rafId = useRef<number | null>(null)
  const cachedRect = useRef<CachedRect | null>(null)

  // Always-current refs — callbacks read these instead of closing over stale values
  const onDragRef = useRef(onDrag)
  const onCommitRef = useRef(onCommit)
  const onCancelRef = useRef(onCancel)
  const gridColsRef = useRef(gridCols)
  const gridRowsRef = useRef(gridRows)
  const cellPxRef = useRef(cellPx)

  useEffect(() => { onDragRef.current = onDrag }, [onDrag])
  useEffect(() => { onCommitRef.current = onCommit }, [onCommit])
  useEffect(() => { onCancelRef.current = onCancel }, [onCancel])
  useEffect(() => { gridColsRef.current = gridCols }, [gridCols])
  useEffect(() => { gridRowsRef.current = gridRows }, [gridRows])
  useEffect(() => { cellPxRef.current = cellPx }, [cellPx])

  const refreshCache = useCallback(() => {
    if (!boardRef.current) return
    const r = boardRef.current.getBoundingClientRect()
    cachedRect.current = { left: r.left, top: r.top, w: r.width, h: r.height }
  }, [boardRef])

  const cancelDrag = useCallback(() => {
    if (rafId.current !== null) { cancelAnimationFrame(rafId.current); rafId.current = null }
    isDragging.current = false
    startCell.current = null
    currentRect.current = null
    onCancelRef.current()
  }, [])

  // On resize: refresh board position and cancel any ongoing drag (layout has changed)
  useEffect(() => {
    const onResize = () => {
      refreshCache()
      if (isDragging.current) cancelDrag()
    }
    window.addEventListener('resize', onResize, { passive: true })
    window.addEventListener('scroll', refreshCache, { passive: true })
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', refreshCache)
    }
  }, [refreshCache, cancelDrag])

  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      const phase = getPhase ? getPhase() : useGameStore.getState().gamePhase
      if (phase !== 'playing') return
      refreshCache()
      const cr = cachedRect.current
      if (!cr) return
      const x = e.clientX - cr.left
      const y = e.clientY - cr.top
      const inZone = requireStartInside
        ? x >= 0 && x < cr.w && y >= 0 && y < cr.h
        : x >= -OUTSIDE_MARGIN && x <= cr.w + OUTSIDE_MARGIN &&
          y >= -OUTSIDE_MARGIN && y <= cr.h + OUTSIDE_MARGIN
      if (!inZone) return
      e.preventDefault()
      const cell = clampCell(x, y, cr.w, cr.h, gridColsRef.current, gridRowsRef.current, cellPxRef.current)
      startCell.current = cell
      isDragging.current = true
      const rect: SelectionRect = { startRow: cell.row, startCol: cell.col, endRow: cell.row, endCol: cell.col }
      currentRect.current = rect
      onDragRef.current(rect)
    }

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current || !startCell.current) return
      if (rafId.current !== null) cancelAnimationFrame(rafId.current)
      const cx = e.clientX
      const cy = e.clientY
      rafId.current = requestAnimationFrame(() => {
        rafId.current = null
        if (!isDragging.current || !startCell.current || !cachedRect.current) return
        const cr = cachedRect.current
        const { row, col } = clampCell(cx - cr.left, cy - cr.top, cr.w, cr.h, gridColsRef.current, gridRowsRef.current, cellPxRef.current)
        const rect: SelectionRect = {
          startRow: startCell.current.row,
          startCol: startCell.current.col,
          endRow: row,
          endCol: col,
        }
        currentRect.current = rect
        onDragRef.current(rect)
      })
    }

    const onMouseUp = () => {
      if (!isDragging.current) return
      if (rafId.current !== null) { cancelAnimationFrame(rafId.current); rafId.current = null }
      isDragging.current = false
      startCell.current = null
      const rect = currentRect.current
      currentRect.current = null
      const phase = getPhase ? getPhase() : useGameStore.getState().gamePhase
      if (rect && phase === 'playing') onCommitRef.current(rect)
      else onCancelRef.current()
    }

    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      if (rafId.current !== null) cancelAnimationFrame(rafId.current)
    }
  }, [getPhase, refreshCache, requireStartInside])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const phase = getPhase ? getPhase() : useGameStore.getState().gamePhase
    if (phase !== 'playing') return
    refreshCache()
    const cr = cachedRect.current
    if (!cr) return
    const touch = e.touches[0]
    const x = touch.clientX - cr.left
    const y = touch.clientY - cr.top
    if (x < 0 || x >= cr.w || y < 0 || y >= cr.h) return
    const cell = clampCell(x, y, cr.w, cr.h, gridColsRef.current, gridRowsRef.current, cellPxRef.current)
    startCell.current = cell
    isDragging.current = true
    const rect: SelectionRect = { startRow: cell.row, startCol: cell.col, endRow: cell.row, endCol: cell.col }
    currentRect.current = rect
    onDragRef.current(rect)
  }, [getPhase, refreshCache])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging.current || !startCell.current || !cachedRect.current) return
    e.preventDefault()
    if (rafId.current !== null) cancelAnimationFrame(rafId.current)
    const cx = e.touches[0].clientX
    const cy = e.touches[0].clientY
    rafId.current = requestAnimationFrame(() => {
      rafId.current = null
      if (!isDragging.current || !startCell.current || !cachedRect.current) return
      const cr = cachedRect.current
      const { row, col } = clampCell(cx - cr.left, cy - cr.top, cr.w, cr.h, gridColsRef.current, gridRowsRef.current, cellPxRef.current)
      const rect: SelectionRect = {
        startRow: startCell.current.row,
        startCol: startCell.current.col,
        endRow: row,
        endCol: col,
      }
      currentRect.current = rect
      onDragRef.current(rect)
    })
  }, [])

  const handleTouchEnd = useCallback(() => {
    if (!isDragging.current) return
    if (rafId.current !== null) { cancelAnimationFrame(rafId.current); rafId.current = null }
    isDragging.current = false
    startCell.current = null
    const rect = currentRect.current
    currentRect.current = null
    const phase = getPhase ? getPhase() : useGameStore.getState().gamePhase
    if (rect && phase === 'playing') onCommitRef.current(rect)
    else onCancelRef.current()
  }, [getPhase])

  return { handleTouchStart, handleTouchMove, handleTouchEnd }
}
