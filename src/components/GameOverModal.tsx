import { useState, useEffect, useRef } from 'react'
import { useGameStore } from '../store/gameStore'
import { useAuthStore } from '../store/authStore'
import { submitScore, submitTimeAttackScore, fetchProfile } from '../lib/supabase'
import { Leaderboard } from './Leaderboard'
import { C } from '../theme/tokens'
import { AuthModal } from './AuthModal'
import { ScoreChart, HistoryEntry } from './ScoreChart'
import { formatTime } from '../utils/gameLogic'
import { unlockAudio } from '../utils/sound'
import { useIsPortrait } from '../hooks/useIsPortrait'

type Phase = 'submitting' | 'leaderboard' | 'guest'

export function GameOverModal() {
  const { score, personalBest, personalBestTime, elapsedTime, gameMode, isNewRecord, isAIGame, startGame, goHome } = useGameStore()
  const { user, displayName, setPendingAuth } = useAuthStore()
  const { isPortrait } = useIsPortrait()

  const isTimeAttack = gameMode === 'time'

  const [phase, setPhase] = useState<Phase>(user && !isAIGame ? 'submitting' : 'guest')
  const [submittedName, setSubmittedName] = useState<string | undefined>()
  const [showAuth, setShowAuth] = useState(false)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [taHistory, setTaHistory] = useState<{ time_seconds: number; played_at: string }[]>([])
  const didSubmit = useRef(false)

  async function submitAndShowHistory(dn: string) {
    const submittedAt = new Date().toISOString()
    if (!isTimeAttack) {
      try { await submitScore(dn, score) } catch {}
      try {
        const profile = await fetchProfile()
        const hist = profile.history
        const hasCurrentEntry = hist.some(
          h => h.score === score && new Date(h.played_at).getTime() >= Date.now() - 10_000
        )
        setHistory(hasCurrentEntry ? hist : [...hist, { score, played_at: submittedAt }])
      } catch {
        setHistory([{ score, played_at: submittedAt }])
      }
    } else {
      try { await submitTimeAttackScore(dn, elapsedTime) } catch {}
      try {
        const profile = await fetchProfile()
        const hist = profile.timeAttackHistory
        const hasCurrentEntry = hist.some(
          h => h.time_seconds === elapsedTime && new Date(h.played_at).getTime() >= Date.now() - 10_000
        )
        setTaHistory(hasCurrentEntry ? hist : [...hist, { time_seconds: elapsedTime, played_at: submittedAt }])
      } catch {
        setTaHistory([{ time_seconds: elapsedTime, played_at: submittedAt }])
      }
    }
  }

  useEffect(() => {
    if (phase !== 'submitting' || !displayName || didSubmit.current) return
    didSubmit.current = true
    submitAndShowHistory(displayName).then(() => {
      setSubmittedName(displayName)
      setPhase('leaderboard')
    })
  }, [phase, displayName, score])

  async function handleAuthSuccess() {
    setShowAuth(false)
    const { displayName: dn } = useAuthStore.getState()
    if (!dn) return
    await submitAndShowHistory(dn)
    setSubmittedName(dn)
    setPhase('leaderboard')
  }

  const sheetStyle: React.CSSProperties = isPortrait
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
        maxWidth: 380,
        width: 'calc(100% - 32px)',
        borderRadius: 24,
        padding: 24,
        maxHeight: '90vh',
        overflowY: 'auto',
        background: C.surface,
        border: `1px solid ${C.borderStrong}`,
      }

  return (
    <>
      <div
        className={`fixed inset-0 z-50 ${isPortrait ? 'flex items-end' : 'flex items-center justify-center'}`}
        style={{ background: C.scrim75, backdropFilter: 'blur(4px)' }}
      >
        <div
          className={isPortrait ? 'bottom-sheet-in' : ''}
          style={sheetStyle}
        >
          {/* 바텀시트 핸들 */}
          {isPortrait && (
            <div style={{ width: 36, height: 4, borderRadius: 2, background: C.borderStrong, margin: '8px auto 16px' }} />
          )}

          {/* 헤더 */}
          <div className="text-center mb-4">
            <div className="text-4xl mb-1">{isTimeAttack ? '🎯' : isNewRecord ? '🏆' : '⏱️'}</div>
            <h2 className="text-2xl font-bold" style={{ color: C.textPrimary }}>
              {isTimeAttack ? '타임 어택 클리어!' : isNewRecord ? '신기록 달성!' : '게임 종료'}
            </h2>
            {isNewRecord && (
              <p className="text-xs font-semibold mt-0.5" style={{ color: C.accentYellow }}>새 최고 기록!</p>
            )}
          </div>

          {/* 점수 */}
          <div className="flex gap-2 mb-4">
            <div className="flex-1 rounded-2xl py-3 text-center" style={{ background: C.surfaceRaised }}>
              <div className="text-gray-400 text-xs uppercase tracking-widest">
                {isTimeAttack ? '클리어 시간' : '최종 점수'}
              </div>
              <div className="text-4xl font-bold mt-0.5" style={{ color: C.textPrimary }}>
                {isTimeAttack ? formatTime(elapsedTime) : score}
              </div>
            </div>
            <div className="flex-1 rounded-2xl py-3 text-center" style={{ background: C.surfaceRaised }}>
              <div className="text-gray-400 text-xs uppercase tracking-widest">최고기록</div>
              <div className="text-4xl font-bold mt-0.5" style={{ color: C.accentYellow }}>
                {isTimeAttack
                  ? (personalBestTime > 0 ? formatTime(personalBestTime) : '-')
                  : personalBest}
              </div>
            </div>
          </div>

          {/* AI 데모 안내 */}
          {isAIGame && (
            <div className="text-center text-xs mb-4 py-2 rounded-xl" style={{ background: C.surfaceDim, color: C.textSub }}>
              🤖 AI 데모 결과는 랭킹에 등록되지 않습니다
            </div>
          )}

          {/* 자동 제출 중 */}
          {!isAIGame && phase === 'submitting' && (
            <div className="text-center text-gray-400 text-sm mb-4 py-2">랭킹 등록 중...</div>
          )}

          {/* 게스트 안내 */}
          {!isAIGame && phase === 'guest' && (
            <div className="mb-4">
              <button
                onClick={() => setShowAuth(true)}
                className="w-full py-3 rounded-2xl text-sm font-bold text-white bg-gradient-to-r from-green-500 to-emerald-600 transition-all active:scale-95 mb-2"
              >
                🏆 로그인 후 랭킹 등록하기
              </button>
              <button
                onClick={() => setPhase('leaderboard')}
                className="w-full py-2.5 rounded-xl text-sm font-semibold text-gray-400 transition-colors"
              >
                건너뛰기
              </button>
            </div>
          )}

          {/* 랭킹 + 히스토리 */}
          {phase === 'leaderboard' && (
            <div className="mb-4 flex flex-col gap-4">
              <div>
                <p className="text-gray-400 text-xs uppercase tracking-widest text-center mb-2 font-semibold">
                  🏆 TOP 10
                </p>
                {isTimeAttack ? (
                  <Leaderboard mode="time" highlightName={submittedName} highlightTime={elapsedTime} />
                ) : (
                  <Leaderboard highlightName={submittedName} highlightScore={score} />
                )}
              </div>
              {!isTimeAttack && history.length > 0 && (
                <div>
                  <p className="text-gray-400 text-xs uppercase tracking-widest font-semibold mb-2">
                    점수 히스토리
                  </p>
                  <div
                    className="rounded-2xl p-3"
                    style={{ background: C.surfaceDim, border: `1px solid ${C.borderFaint}` }}
                  >
                    <ScoreChart history={history} />
                  </div>
                  <div className="text-xs text-gray-600 text-right mt-1.5">
                    ★ 최고점 &nbsp;• 최근 {history.length}게임
                  </div>
                </div>
              )}
              {isTimeAttack && taHistory.length > 0 && (
                <div>
                  <p className="text-gray-400 text-xs uppercase tracking-widest font-semibold mb-2">
                    기록 히스토리
                  </p>
                  <div
                    className="rounded-2xl p-3"
                    style={{ background: C.surfaceDim, border: `1px solid ${C.borderFaint}` }}
                  >
                    <ScoreChart
                      history={taHistory.map(h => ({ score: h.time_seconds, played_at: h.played_at }))}
                      inverse
                      formatValue={formatTime}
                    />
                  </div>
                  <div className="text-xs text-gray-600 text-right mt-1.5">
                    ★ 최고기록 &nbsp;• 최근 {taHistory.length}게임 (낮을수록 좋음)
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2 mt-auto pt-2">
            <button
              onClick={goHome}
              className="flex-1 py-3.5 rounded-2xl text-base font-bold transition-all active:scale-95 panel-hover"
              style={{ background: C.surfaceRaised, color: C.textSub, border: `1px solid ${C.borderGhost}` }}
            >
              🏠 홈
            </button>
            <button
              onClick={() => { unlockAudio(); startGame() }}
              className="flex-1 py-3.5 rounded-2xl text-base font-bold text-white bg-gradient-to-r from-green-500 to-emerald-600 transition-all active:scale-95 shadow-lg"
            >
              다시 시작
            </button>
          </div>
        </div>
      </div>

      {showAuth && (
        <AuthModal
          onSuccess={handleAuthSuccess}
          onClose={() => setShowAuth(false)}
          onSignupDone={() => {
            setShowAuth(false)
            setPendingAuth({ notice: '📧 인증 메일을 확인 후 로그인해 주세요.', openLogin: true })
            goHome()
          }}
        />
      )}
    </>
  )
}
