import { useState } from 'react'
import { useMultiStore } from '../store/multiStore'
import { C } from '../theme/tokens'
import { SegmentedControl } from './SegmentedControl'
import { useIsPortrait } from '../hooks/useIsPortrait'

export function MultiLobby() {
  const { isHost, roomCode, myName, opponentName, gameMode, setGameMode, startGame, leaveRoom } = useMultiStore()
  const { isPortrait } = useIsPortrait()
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    if (!roomCode) return
    navigator.clipboard.writeText(roomCode).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div
      className={`fixed inset-0 z-[60] ${isPortrait ? 'flex items-end' : 'flex items-center justify-center'}`}
      style={{ background: C.scrim85, backdropFilter: 'blur(6px)' }}
    >
      <div
        className={`shadow-2xl ${isPortrait ? 'bottom-sheet-in' : ''}`}
        style={
          isPortrait
            ? { width: '100%', borderRadius: '20px 20px 0 0', padding: '8px 24px 32px', background: C.surface, border: `1px solid ${C.borderStrong}`, borderBottom: 'none' }
            : { maxWidth: 380, width: 'calc(100% - 32px)', borderRadius: 24, padding: 24, background: C.surface, border: `1px solid ${C.borderStrong}` }
        }
      >
        {isPortrait && (
          <div style={{ width: 36, height: 4, borderRadius: 2, background: C.borderStrong, margin: '8px auto 16px' }} />
        )}
        {/* 헤더 */}
        <div className="text-center mb-5">
          <div className="text-4xl mb-2">👥</div>
          <h2 className="text-xl font-bold" style={{ color: C.textPrimary }}>멀티 게임</h2>
          {myName && <p className="text-gray-400 text-sm mt-1">👤 {myName}</p>}
        </div>

        <div className="space-y-4">
          {isHost ? (
            <>
              {/* 방 코드 표시 */}
              <div
                className="rounded-2xl p-4 text-center"
                style={{ background: C.roomBg, border: `1px solid ${C.roomBorder}` }}
              >
                <p className="text-gray-400 text-xs uppercase tracking-widest font-semibold mb-2">방 코드</p>
                <p className="text-4xl font-bold tracking-widest" style={{ color: C.textPrimary }}>{roomCode}</p>
                <button
                  onClick={handleCopy}
                  className="mt-2 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95"
                  style={{
                    background: copied ? C.noticeBorder : C.borderGhost,
                    color: copied ? C.greenLight : C.textMuted,
                  }}
                >
                  {copied ? '✓ 복사됨' : '코드 복사'}
                </button>
              </div>

              {/* 상대방 입장 상태 */}
              {opponentName ? (
                <div
                  className="rounded-2xl p-3 text-center"
                  style={{ background: C.joinedBg, border: `1px solid ${C.joinedBorder}` }}
                >
                  <p className="text-green-400 text-sm font-bold">👤 {opponentName} 님이 입장했습니다!</p>
                </div>
              ) : (
                <div className="text-center py-2">
                  <p className="text-gray-400 text-sm animate-pulse">상대방 입장 대기 중...</p>
                </div>
              )}

              {/* 게임 모드 선택 */}
              <div>
                <div className="text-xs text-gray-400 uppercase tracking-widest font-semibold mb-2">게임 모드</div>
                <SegmentedControl
                  options={[
                    { value: 'score', label: '⏱️ 스코어 어택' },
                    { value: 'time',  label: '🎯 타임 어택' },
                  ]}
                  value={gameMode}
                  onChange={setGameMode}
                />
              </div>

              <button
                onClick={startGame}
                disabled={!opponentName}
                className="w-full py-3.5 rounded-2xl text-sm font-bold text-white bg-gradient-to-r from-green-500 to-emerald-600 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                게임 시작
              </button>
            </>
          ) : (
            <>
              {/* 게스트 대기 화면 */}
              <div
                className="rounded-2xl p-4 text-center"
                style={{ background: C.roomBg, border: `1px solid ${C.roomBorder}` }}
              >
                <p className="text-green-400 text-sm font-bold mb-1">✅ 방에 참가했습니다!</p>
                {opponentName && <p className="text-gray-300 text-sm">상대: {opponentName}</p>}
              </div>

              {/* 게임 모드 표시 (읽기 전용) */}
              <div>
                <div className="text-xs text-gray-400 uppercase tracking-widest font-semibold mb-2">게임 모드</div>
                <div
                  className="rounded-xl px-4 py-2.5 text-sm font-semibold text-center"
                  style={{ background: C.borderGhost, color: C.textPrimary }}
                >
                  {gameMode === 'score' ? '⏱️ 스코어 어택' : '🎯 타임 어택'}
                </div>
              </div>

              <div className="text-center py-2">
                <p className="text-gray-400 text-sm animate-pulse">호스트가 게임을 시작할 때까지 대기 중...</p>
              </div>
            </>
          )}

          <button
            onClick={leaveRoom}
            className="w-full py-2.5 rounded-xl text-sm font-semibold text-gray-400 transition-colors"
          >
            나가기
          </button>
        </div>
      </div>
    </div>
  )
}
