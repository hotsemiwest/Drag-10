import { useState, useEffect } from 'react'
import { ROWS } from '../types/game'

const GAP = 2
const DEFAULT_TILE = 52

export function useIsPortrait() {
  const [width, setWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1200
  )
  const [height, setHeight] = useState(() =>
    typeof window !== 'undefined' ? window.innerHeight : 800
  )

  useEffect(() => {
    const handler = () => {
      setWidth(window.innerWidth)
      setHeight(window.innerHeight)
    }
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  const isPortrait = width < height && width < 640

  // Tile size to fit ROWS (10) tiles across the screen width in portrait
  const MIN_TILE = Math.round(DEFAULT_TILE * 0.7)  // 70% = 36px
  const portraitTileSize = isPortrait
    ? Math.min(DEFAULT_TILE, Math.max(MIN_TILE, Math.floor((width - 32 - (ROWS - 1) * GAP) / ROWS)))
    : DEFAULT_TILE

  return { isPortrait, portraitTileSize, screenWidth: width, screenHeight: height }
}
