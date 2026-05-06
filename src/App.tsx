import { useEffect } from 'react'
import { useGameStore } from './store/gameStore'
import { useAuthStore } from './store/authStore'
import { useMultiStore } from './store/multiStore'
import { useThemeStore } from './store/themeStore'
import { C, G } from './theme/tokens'
import { Header } from './components/Header'
import { GameBoard } from './components/GameBoard'
import { GameOverModal } from './components/GameOverModal'
import { StartBoard } from './components/StartBoard'
import { MultiLobby } from './components/MultiLobby'
import { MultiGame } from './components/MultiGame'
import { MultiGameOver } from './components/MultiGameOver'
import { Countdown } from './components/Countdown'
import { DevSidePanel } from './components/DevSidePanel'
import { useIsPortrait } from './hooks/useIsPortrait'
import { ROWS } from './types/game'

const LANDSCAPE_W = 916
const GAP = 2

function ThemeSync() {
  const theme = useThemeStore(s => s.theme)
  useEffect(() => {
    document.body.classList.toggle('theme-light', theme === 'light')
  }, [theme])
  return null
}

export default function App() {
  const gamePhase   = useGameStore(s => s.gamePhase)
  const tick        = useGameStore(s => s.tick)
  const syncTime    = useGameStore(s => s.syncTime)
  const beginPlaying = useGameStore(s => s.beginPlaying)
  const { initialize, pendingAuth, setPendingAuth } = useAuthStore()
  const multiPhase = useMultiStore(s => s.phase)
  const multiBeginPlaying = useMultiStore(s => s.beginPlaying)
  const { isPortrait, portraitTileSize } = useIsPortrait()
  const portraitCell = portraitTileSize + GAP
  const boardWidth = isPortrait ? ROWS * portraitCell - GAP : LANDSCAPE_W

  useEffect(() => { initialize() }, [initialize])

  useEffect(() => {
    if (!pendingAuth || pendingAuth.openLogin) return
    const id = setTimeout(() => setPendingAuth(null), 5000)
    return () => clearTimeout(id)
  }, [pendingAuth, setPendingAuth])

  useEffect(() => {
    if (gamePhase !== 'playing') return
    const id = setInterval(tick, 1000)
    const onVisible = () => { if (!document.hidden) syncTime() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [gamePhase, tick, syncTime])

  return (
    <>
    <ThemeSync />
    <div
      className="min-h-screen flex flex-col items-center justify-center py-6 overflow-x-hidden"
      style={{ userSelect: 'none' }}
    >
      {pendingAuth && !pendingAuth.openLogin && (
        <div
          className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] px-5 py-3 rounded-2xl text-sm font-semibold text-white shadow-xl"
          style={{
            background: G.notice,
            border: `1px solid ${C.borderLit}`,
            whiteSpace: 'nowrap',
          }}
        >
          {pendingAuth.notice}
        </div>
      )}

      <div className="board-scaler" style={{ width: boardWidth }}>
        {multiPhase === 'playing' ? (
          <MultiGame />
        ) : (
          <>
            <Header />
            {gamePhase === 'start' ? <StartBoard /> : <GameBoard />}
          </>
        )}
      </div>

      <DevSidePanel />
      {gamePhase === 'ended' && multiPhase === 'off' && <GameOverModal />}

      {multiPhase === 'waiting' && <MultiLobby />}
      {multiPhase === 'countdown' && <Countdown onFinish={multiBeginPlaying} />}
      {multiPhase === 'ended' && <MultiGameOver />}
      {gamePhase === 'countdown' && multiPhase === 'off' && <Countdown onFinish={beginPlaying} />}
    </div>
    </>
  )
}
