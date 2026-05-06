import { useState, useEffect } from 'react'
import { useGameStore } from '../store/gameStore'
import { useAuthStore } from '../store/authStore'
import { useMultiStore } from '../store/multiStore'
import { useThemeStore } from '../store/themeStore'
import { BOARD_BG, C, G } from '../theme/tokens'
import { AuthModal } from './AuthModal'
import { unlockAudio } from '../utils/sound'
import { useIsPortrait } from '../hooks/useIsPortrait'
import { COLS } from '../types/game'

const LANDSCAPE_BOARD_H = 538  // ROWS * (52+2) - 2

type MultiAfterLogin = 'create' | 'join' | null

export function StartBoard() {
  const { startScoreAttack, startTimeAttack } = useGameStore()
  const theme = useThemeStore(s => s.theme)
  const { user, pendingAuth, setPendingAuth } = useAuthStore()
  const { createRoom, joinRoom, error: multiError, clearError } = useMultiStore()
  const { isPortrait, portraitTileSize } = useIsPortrait()

  const [showAuth, setShowAuth] = useState(false)
  const [authNotice, setAuthNotice] = useState<string | undefined>()
  const [multiAfterLogin, setMultiAfterLogin] = useState<MultiAfterLogin>(null)
  const [codeInput, setCodeInput] = useState('')
  const [creating, setCreating] = useState(false)
  const [joining, setJoining] = useState(false)

  // Portrait board height matches GameBoard portrait height
  const portraitCell = portraitTileSize + 2
  const boardHeight = isPortrait ? COLS * portraitCell - 2 : LANDSCAPE_BOARD_H

  useEffect(() => {
    if (pendingAuth?.openLogin) {
      setAuthNotice(pendingAuth.notice)
      setShowAuth(true)
      setPendingAuth(null)
    }
  }, [pendingAuth, setPendingAuth])

  function closeAuth() {
    setShowAuth(false)
    setAuthNotice(undefined)
    setMultiAfterLogin(null)
  }

  async function handleAuthSuccess() {
    setShowAuth(false)
    setAuthNotice(undefined)
    const pending = multiAfterLogin
    setMultiAfterLogin(null)
    if (pending === 'create') await doCreate()
    else if (pending === 'join') await doJoin()
  }

  function requireLogin(after: MultiAfterLogin) {
    setMultiAfterLogin(after)
    setAuthNotice('멀티게임은 로그인이 필요합니다')
    setShowAuth(true)
  }

  async function doCreate() {
    setCreating(true)
    await createRoom()
    setCreating(false)
  }

  async function doJoin() {
    const code = codeInput.trim()
    if (code.length !== 6) return
    setJoining(true)
    await joinRoom(code)
    setJoining(false)
  }

  function handleCreate() {
    clearError()
    if (!user) { requireLogin('create'); return }
    doCreate()
  }

  function handleJoin() {
    clearError()
    if (!user) { requireLogin('join'); return }
    doJoin()
  }

  return (
    <>
      <div
        className={`flex flex-col items-center justify-center w-full gap-6 ${isPortrait ? 'py-6 px-5' : 'py-10 px-8 gap-10'}`}
        style={{
          height: boardHeight,
          background: BOARD_BG[theme].background,
          border: BOARD_BG[theme].border,
          borderRadius: 16,
          overflowY: 'auto',
        }}
      >
        {/* 타이틀 */}
        <div className="text-center w-full max-w-lg">
          <div className={`${isPortrait ? 'text-4xl' : 'text-5xl'} mb-3`}>🍎</div>
          <h2 className={`${isPortrait ? 'text-2xl' : 'text-3xl'} font-bold mb-1 ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>
            AppleBox
          </h2>
          <p className={`text-gray-400 ${isPortrait ? 'text-sm' : ''}`}>
            드래그로 합이 10이 되는 숫자들을 선택하세요
          </p>
        </div>

        {/* 버튼 영역 */}
        <div className="flex flex-col gap-3 w-full max-w-lg">
          {/* 혼자 하기 */}
          <div className="flex gap-2">
            <button
              onClick={() => { unlockAudio(); startScoreAttack() }}
              className={`flex-1 ${isPortrait ? 'py-3.5 text-base' : 'py-4 text-lg'} rounded-2xl font-bold text-white bg-gradient-to-r from-green-500 to-emerald-600 transition-all active:scale-95 shadow-lg shadow-green-500/20`}
            >
              ⏱️ 스코어 어택
            </button>
            <button
              onClick={() => { unlockAudio(); startTimeAttack() }}
              className={`flex-1 ${isPortrait ? 'py-3.5 text-base' : 'py-4 text-lg'} rounded-2xl font-bold text-white transition-all active:scale-95 shadow-lg`}
              style={{ background: `linear-gradient(135deg, ${C.orange}, ${C.amber})` }}
            >
              🎯 타임 어택
            </button>
          </div>

          {/* 구분선 */}
          <div className="flex items-center gap-3 my-1">
            <div className={`flex-1 border-t ${theme === 'light' ? 'border-gray-200' : 'border-gray-700'}`} />
            <span className="text-gray-500 text-sm whitespace-nowrap">또는 다른 사람과 함께</span>
            <div className={`flex-1 border-t ${theme === 'light' ? 'border-gray-200' : 'border-gray-700'}`} />
          </div>

          {/* 방 만들기 */}
          <button
            onClick={handleCreate}
            disabled={creating}
            className={`w-full ${isPortrait ? 'py-3.5 text-lg' : 'py-4 text-xl'} rounded-2xl font-bold text-white transition-all active:scale-95 disabled:opacity-60 shadow-lg`}
            style={{ background: G.blueIndigo, boxShadow: `0 4px 20px ${C.indigoGlow}` }}
          >
            {creating ? '생성 중...' : '방 만들기'}
          </button>

          {/* 초대코드 입력 + 참여 */}
          <div className="flex gap-2">
            <input
              type="text"
              value={codeInput}
              onChange={e => { setCodeInput(e.target.value.replace(/\D/g, '').slice(0, 6)); clearError() }}
              onKeyDown={e => e.key === 'Enter' && handleJoin()}
              placeholder="초대코드 입력"
              className={`flex-1 min-w-0 rounded-2xl px-3 ${isPortrait ? 'py-3' : 'py-4'} text-base outline-none border input-adaptive input-adaptive-blue transition-colors text-center tracking-widest font-bold`}
              style={{ background: C.inputBg, color: C.textPrimary }}
              maxLength={6}
            />
            <button
              onClick={handleJoin}
              disabled={joining || codeInput.trim().length !== 6}
              className={`${isPortrait ? 'px-4' : 'px-6'} ${isPortrait ? 'py-3' : 'py-4'} shrink-0 rounded-2xl text-base font-bold text-white transition-all active:scale-95 disabled:opacity-50`}
              style={{ background: G.blueIndigo }}
            >
              {joining ? '...' : '참여'}
            </button>
          </div>

          {multiError && (
            <p className="text-red-400 text-xs text-center">{multiError}</p>
          )}
        </div>
      </div>

      {showAuth && (
        <AuthModal
          notice={authNotice}
          initialTab="login"
          onSuccess={handleAuthSuccess}
          onClose={closeAuth}
        />
      )}
    </>
  )
}
