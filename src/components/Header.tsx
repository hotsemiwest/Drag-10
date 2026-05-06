import { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useGameStore } from '../store/gameStore'
import { useAuthStore } from '../store/authStore'
import { useThemeStore } from '../store/themeStore'
import { countSolutions, formatTime } from '../utils/gameLogic'
import { TIME_ATTACK_TARGET } from '../types/game'
import { Leaderboard } from './Leaderboard'
import { AuthModal } from './AuthModal'
import { ProfileModal } from './ProfileModal'
import { SettingsButton } from './SettingsButton'
import { C, G } from '../theme/tokens'
import { SegmentedControl } from './SegmentedControl'
import { getDifficultyStarCount } from '../config/difficultyConfig'
import { unlockAudio } from '../utils/sound'
import { useIsPortrait } from '../hooks/useIsPortrait'

export function Header() {
  const score          = useGameStore(s => s.score)
  const personalBest   = useGameStore(s => s.personalBest)
  const personalBestTime = useGameStore(s => s.personalBestTime)
  const timeLeft       = useGameStore(s => s.timeLeft)
  const elapsedTime    = useGameStore(s => s.elapsedTime)
  const gameMode       = useGameStore(s => s.gameMode)
  const gamePhase      = useGameStore(s => s.gamePhase)
  const startGame      = useGameStore(s => s.startGame)
  const goHome         = useGameStore(s => s.goHome)
  const board          = useGameStore(s => s.board)
  const boardDifficulty = useGameStore(s => s.boardDifficulty)
  const { user, displayName, signOut, setPendingAuth } = useAuthStore()
  const theme = useThemeStore(s => s.theme)
  const showHintCount = useThemeStore(s => s.showHintCount)
  const showDifficulty = useThemeStore(s => s.showDifficulty)
  const { isPortrait } = useIsPortrait()

  const solutionCount = useMemo(() => {
    if (!showHintCount || gamePhase !== 'playing') return 0
    return countSolutions(board)
  }, [board, showHintCount, gamePhase])
  const [showLeaderboard, setShowLeaderboard] = useState(false)
  const [leaderboardTab, setLeaderboardTab] = useState<'score' | 'time'>('score')
  const [showAuth, setShowAuth] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [selectedUser, setSelectedUser] = useState<{ user_id: string; display_name: string } | null>(null)

  function handleLeaderboardUserClick(entry: { user_id: string; display_name: string }) {
    setShowLeaderboard(false)
    setSelectedUser(entry)
  }

  const isStart = gamePhase === 'start'
  const isUrgent = timeLeft <= 30 && gamePhase === 'playing'
  const difficultyStars = getDifficultyStarCount(boardDifficulty ?? 0)

  // 포트레이트 모드 점수 폰트 크기
  const scoreFontClass = isPortrait ? 'text-xl font-bold' : 'text-3xl font-bold'
  const timerFontClass = isPortrait ? 'text-2xl font-black tabular-nums' : 'text-4xl font-black tabular-nums'
  const labelClass = 'text-xs text-gray-400 uppercase tracking-widest font-semibold'

  return (
    <>
      <div className="w-full mb-2">
        <div className={`flex items-center justify-between w-full ${isPortrait ? 'py-2 gap-1' : 'py-3'}`}>

          {/* 왼쪽: 점수 / 최고기록 */}
          <div className={`flex ${isPortrait ? 'gap-3' : 'gap-6'} flex-1 min-w-0`}>
            {!isStart ? (
              <>
                {gameMode === 'time' ? (
                  <>
                    <div className="text-center shrink-0">
                      <div className={labelClass}>진행도</div>
                      <div key={score} className={`${scoreFontClass} score-display ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>
                        {score}<span className={`${isPortrait ? 'text-xs' : 'text-base'} font-semibold text-gray-400`}>/{TIME_ATTACK_TARGET}</span>
                      </div>
                    </div>
                    {personalBestTime > 0 && (
                      <div className="text-center shrink-0">
                        <div className={labelClass}>최고기록</div>
                        <div className={`${isPortrait ? 'text-xl' : 'text-3xl'} font-bold`} style={{ color: C.orange }}>{formatTime(personalBestTime)}</div>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="text-center shrink-0">
                      <div className={labelClass}>점수</div>
                      <div key={score} className={`${scoreFontClass} score-display ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>{score}</div>
                    </div>
                    <div className="text-center shrink-0">
                      <div className={labelClass}>최고기록</div>
                      <div className={`${isPortrait ? 'text-xl' : 'text-3xl'} font-bold`} style={{ color: C.accentYellow }}>{personalBest}</div>
                    </div>
                  </>
                )}
                {gamePhase === 'playing' && !isPortrait && (showHintCount || showDifficulty) && (
                  <>
                    {showHintCount && (
                      <div className="text-center shrink-0">
                        <div className={labelClass}>조합 수</div>
                        <div className="text-3xl font-bold" style={{ color: C.blue }}>{solutionCount}</div>
                      </div>
                    )}
                    {showDifficulty && (
                      <div className="text-center shrink-0">
                        <div className={labelClass}>난이도</div>
                        <div className="text-3xl font-bold tracking-tight" style={{ color: C.orange }}>{difficultyStars}</div>
                      </div>
                    )}
                  </>
                )}
              </>
            ) : (personalBest > 0 || personalBestTime > 0) ? (
              <div className={`flex items-center ${isPortrait ? 'gap-1.5 flex-wrap' : 'gap-2'}`}>
                {personalBest > 0 && (
                  <div
                    className={`flex items-center gap-1 px-2 py-1.5 rounded-lg ${isPortrait ? 'text-xs' : 'text-sm'} font-semibold`}
                    style={{ background: C.surfaceRaised, border: `1px solid ${C.borderGhost}` }}
                  >
                    <span style={{ color: C.textSub }}>⏱️</span>
                    <span className="font-bold" style={{ color: C.accentYellow }}>{personalBest}점</span>
                  </div>
                )}
                {personalBestTime > 0 && (
                  <div
                    className={`flex items-center gap-1 px-2 py-1.5 rounded-lg ${isPortrait ? 'text-xs' : 'text-sm'} font-semibold`}
                    style={{ background: C.surfaceRaised, border: `1px solid ${C.borderGhost}` }}
                  >
                    <span style={{ color: C.textSub }}>🎯</span>
                    <span className="font-bold" style={{ color: C.accentYellow }}>{formatTime(personalBestTime)}</span>
                  </div>
                )}
              </div>
            ) : null}
          </div>

          {/* 중앙: 타이머 */}
          <div className="text-center shrink-0">
            {!isStart && (
              gameMode === 'time' ? (
                <>
                  {!isPortrait && <div className={labelClass}>경과 시간</div>}
                  <div className={`${timerFontClass} ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>
                    {formatTime(elapsedTime)}
                  </div>
                </>
              ) : (
                <>
                  {!isPortrait && <div className={labelClass}>남은 시간</div>}
                  <div
                    className={`${timerFontClass} transition-colors ${
                      isUrgent ? `${theme === 'light' ? 'text-red-600' : 'text-red-400'} timer-shake` : theme === 'light' ? 'text-gray-900' : 'text-white'
                    }`}
                  >
                    {formatTime(timeLeft)}
                  </div>
                </>
              )
            )}
          </div>

          {/* 오른쪽 버튼들 */}
          <div className={`flex items-center justify-end ${isPortrait ? 'gap-1' : 'gap-2'} flex-1`}>
            {isStart ? (
              <>
                <SettingsButton />
                <button
                  onClick={() => setShowLeaderboard(true)}
                  className={`${isPortrait ? 'px-2 py-2 text-xs' : 'px-3 py-2 text-sm'} rounded-lg font-semibold transition-all active:scale-95`}
                  style={{ background: C.surfaceRaised, color: C.textSub, border: `1px solid ${C.borderGhost}` }}
                >
                  {isPortrait ? '🏆' : '🏆 랭킹'}
                </button>

                {user ? (
                  <div className={`flex items-center ${isPortrait ? 'gap-1' : 'gap-2'}`}>
                    <button
                      onClick={() => setShowProfile(true)}
                      className={`${isPortrait ? 'px-2 py-2 text-xs' : 'px-3 py-2 text-sm'} rounded-lg transition-all active:scale-95`}
                      style={{ background: C.surfaceRaised, border: `1px solid ${C.borderGhost}` }}
                    >
                      <span className={`font-semibold ${theme === 'light' ? 'text-gray-700' : 'text-gray-200'}`}>
                        {isPortrait ? '👤' : `👤 ${displayName}`}
                      </span>
                    </button>
                    <button
                      onClick={signOut}
                      className={`${isPortrait ? 'px-2 py-2 text-xs' : 'px-3 py-2 text-sm'} rounded-lg font-semibold transition-all active:scale-95`}
                      style={{ background: C.surfaceRaised, color: C.textSub, border: `1px solid ${C.borderGhost}` }}
                    >
                      {isPortrait ? '🚪' : '로그아웃'}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowAuth(true)}
                    className={`${isPortrait ? 'px-2 py-2 text-xs' : 'px-3 py-2 text-sm'} rounded-lg font-semibold transition-all active:scale-95`}
                    style={{ background: C.surfaceRaised, color: C.textSub, border: `1px solid ${C.borderGhost}` }}
                  >
                    {isPortrait ? '🔑' : '로그인'}
                  </button>
                )}
              </>
            ) : (
              <>
                <SettingsButton />
                <button
                  onClick={goHome}
                  className={`${isPortrait ? 'px-2 py-2 text-xs' : 'px-3 py-2 text-sm'} rounded-lg font-semibold transition-all active:scale-95`}
                  style={{ background: C.surfaceRaised, color: C.textSub, border: `1px solid ${C.borderGhost}` }}
                >
                  {isPortrait ? '🏠' : '🏠 나가기'}
                </button>
                <button
                  onClick={() => { unlockAudio(); startGame() }}
                  className={`${isPortrait ? 'px-2 py-2 text-xs' : 'px-3 py-2 text-sm'} rounded-lg font-semibold transition-all active:scale-95`}
                  style={{ background: C.surfaceRaised, color: C.textSub, border: `1px solid ${C.borderGhost}` }}
                >
                  {isPortrait ? '🔄' : '🔄 다시하기'}
                </button>
              </>
            )}
          </div>
        </div>

        {/* 게이지바 */}
        {!isStart && (
          <div
            className="w-full h-2 rounded-full overflow-hidden"
            style={{ background: C.borderGhost }}
          >
            <div
              className="h-full rounded-full transition-all duration-1000 ease-linear"
              style={{
                width: gameMode === 'time'
                  ? `${Math.min((score / TIME_ATTACK_TARGET) * 100, 100)}%`
                  : `${(timeLeft / 120) * 100}%`,
                background: gameMode === 'time'
                  ? `linear-gradient(90deg, ${C.orange}, ${C.amber})`
                  : isUrgent ? G.timerUrgent : G.timerNormal,
              }}
            />
          </div>
        )}
      </div>

      {/* 랭킹 모달 (포트레이트: 바텀시트) */}
      {showLeaderboard && createPortal(
        <div
          className={`fixed inset-0 z-50 ${isPortrait ? 'flex items-end' : 'flex items-center justify-center'}`}
          style={{ background: C.scrim75, backdropFilter: 'blur(4px)' }}
          onClick={() => setShowLeaderboard(false)}
        >
          <div
            className={`shadow-2xl ${isPortrait ? 'bottom-sheet-in' : ''}`}
            style={
              isPortrait
                ? {
                    width: '100%',
                    borderRadius: '20px 20px 0 0',
                    padding: '8px 20px 32px',
                    maxHeight: '80dvh',
                    overflowY: 'auto',
                    background: C.surface,
                    border: `1px solid ${C.borderStrong}`,
                    borderBottom: 'none',
                  }
                : {
                    maxWidth: 360,
                    width: 'calc(100% - 32px)',
                    borderRadius: 24,
                    padding: 24,
                    maxHeight: '80vh',
                    overflowY: 'auto',
                    background: C.surface,
                    border: `1px solid ${C.borderStrong}`,
                  }
            }
            onClick={e => e.stopPropagation()}
          >
            {isPortrait && (
              <div style={{ width: 36, height: 4, borderRadius: 2, background: C.borderStrong, margin: '8px auto 16px' }} />
            )}
            <h2 className="text-xl font-bold text-center mb-3" style={{ color: C.textPrimary }}>🏆 TOP 10</h2>
            <div className="mb-3">
              <SegmentedControl
                options={[
                  { value: 'score', label: '⏱️ 스코어 어택' },
                  { value: 'time',  label: '🎯 타임 어택' },
                ]}
                value={leaderboardTab}
                onChange={setLeaderboardTab}
              />
            </div>
            <Leaderboard mode={leaderboardTab} onUserClick={handleLeaderboardUserClick} />
            <button
              onClick={() => setShowLeaderboard(false)}
              className="w-full mt-4 py-3.5 rounded-2xl text-sm font-bold transition-all active:scale-95 panel-hover"
              style={{ background: C.surfaceRaised, color: C.textSub }}
            >
              닫기
            </button>
          </div>
        </div>,
        document.body
      )}

      {showAuth && (
        <AuthModal
          onSuccess={() => setShowAuth(false)}
          onClose={() => setShowAuth(false)}
          onSignupDone={() => {
            setShowAuth(false)
            setPendingAuth({ notice: '📧 인증 메일을 확인 후 로그인해 주세요.', openLogin: true })
          }}
        />
      )}

      {showProfile && (
        <ProfileModal onClose={() => setShowProfile(false)} />
      )}

      {selectedUser && (
        <ProfileModal
          onClose={() => setSelectedUser(null)}
          targetUserId={selectedUser.user_id}
          targetDisplayName={selectedUser.display_name}
        />
      )}
    </>
  )
}
