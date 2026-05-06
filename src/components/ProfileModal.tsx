import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAuthStore } from '../store/authStore'
import { fetchProfile, fetchPublicProfile, ProfileData, checkDisplayNameTaken } from '../lib/supabase'
import { ScoreChart } from './ScoreChart'
import { C } from '../theme/tokens'
import { SegmentedControl } from './SegmentedControl'
import { formatTime } from '../utils/gameLogic'
import { useIsPortrait } from '../hooks/useIsPortrait'

interface Props {
  onClose: () => void
  targetUserId?: string
  targetDisplayName?: string
}

const RANK_MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }

function rankLabel(rank: number) {
  if (rank <= 3) return RANK_MEDALS[rank]
  if (rank <= 10) return `#${rank}위`
  return `#${rank}위`
}

function rankColor(rank: number) {
  if (rank === 1) return C.rankGold
  if (rank === 2) return C.rankSilver
  if (rank === 3) return C.rankBronze
  if (rank <= 10) return C.rankGreen
  return C.rankDefault
}

export function ProfileModal({ onClose, targetUserId, targetDisplayName }: Props) {
  const { user, displayName, updateDisplayName } = useAuthStore()
  const { isPortrait } = useIsPortrait()
  const [data, setData] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [tab, setTab] = useState<'score' | 'time'>('score')
  const [editingName, setEditingName] = useState<string | null>(null)
  const [nameError, setNameError] = useState('')
  const [saving, setSaving] = useState(false)

  const isOwnProfile = !targetUserId || targetUserId === user?.id
  const shownName = isOwnProfile ? displayName : targetDisplayName

  async function handleSaveName() {
    const trimmed = (editingName ?? '').trim()
    if (!trimmed) { setNameError('닉네임을 입력해주세요'); return }
    if (trimmed.length > 16) { setNameError('최대 16자까지 입력 가능합니다'); return }
    setSaving(true)
    setNameError('')
    try {
      const taken = await checkDisplayNameTaken(trimmed, user?.id)
      if (taken) { setNameError('이미 사용 중인 닉네임입니다'); setSaving(false); return }
      await updateDisplayName(trimmed)
      setEditingName(null)
    } catch {
      setNameError('저장에 실패했습니다')
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    const fetch = isOwnProfile
      ? fetchProfile()
      : fetchPublicProfile(targetUserId!)
    fetch
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [isOwnProfile, targetUserId])

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
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
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
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }

  return createPortal(
    <div
      className={`fixed inset-0 z-[60] ${isPortrait ? 'flex items-end' : 'flex items-center justify-center'}`}
      style={{ background: C.scrim80, backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className={`shadow-2xl ${isPortrait ? 'bottom-sheet-in' : ''}`}
        style={sheetStyle}
        onClick={e => e.stopPropagation()}
      >
        {isPortrait && (
          <div style={{ width: 36, height: 4, borderRadius: 2, background: C.borderStrong, margin: '8px auto 0' }} />
        )}

        {/* 계정 정보 */}
        <div className="text-center">
          <div className="text-4xl mb-2">👤</div>
          {isOwnProfile && editingName !== null ? (
            <div className="flex flex-col items-center gap-2">
              <input
                type="text"
                value={editingName}
                onChange={e => setEditingName(e.target.value.slice(0, 16))}
                onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setEditingName(null) }}
                className="text-center rounded-xl px-3 py-1.5 text-lg font-bold outline-none border input-adaptive transition-colors w-48"
                style={{ background: C.inputBg, color: C.textPrimary }}
                autoFocus
              />
              {nameError && <p className="text-red-400 text-xs">{nameError}</p>}
              <div className="flex gap-2">
                <button
                  onClick={() => { setEditingName(null); setNameError('') }}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all panel-hover"
                  style={{ background: C.surfaceRaised, color: C.textSub }}
                >
                  취소
                </button>
                <button
                  onClick={handleSaveName}
                  disabled={saving}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-green-600 transition-all disabled:opacity-50"
                >
                  {saving ? '저장 중...' : '저장'}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1.5">
              <div className="text-xl font-bold" style={{ color: C.textPrimary }}>{shownName}</div>
              {isOwnProfile && (
                <div className="text-xs text-gray-400">{user?.email}</div>
              )}
              {isOwnProfile && (
                <button
                  onClick={() => setEditingName(displayName ?? '')}
                  className="px-2 py-1 rounded-lg text-xs font-semibold transition-all panel-hover"
                  style={{ background: C.surfaceRaised, color: C.textMuted }}
                >
                  닉네임 변경
                </button>
              )}
            </div>
          )}
        </div>

        {loading && (
          <div className="text-center text-gray-400 text-sm py-4">불러오는 중...</div>
        )}

        {error && (
          <div className="text-center text-red-400 text-sm py-4">데이터를 불러올 수 없습니다</div>
        )}

        {data && !loading && (
          <>
            <SegmentedControl
              options={[
                { value: 'score', label: '⏱️ 스코어 어택' },
                { value: 'time',  label: '🎯 타임 어택' },
              ]}
              value={tab}
              onChange={setTab}
            />

            {tab === 'score' && (
              <>
                {data.rank !== null ? (
                  <div className="text-center py-2">
                    <div className="text-5xl font-black" style={{ color: rankColor(data.rank) }}>
                      {data.rank <= 3 ? RANK_MEDALS[data.rank] : null}
                      {data.rank > 3 ? rankLabel(data.rank) : null}
                    </div>
                    {data.rank <= 3 && <div className="text-lg font-bold mt-1" style={{ color: rankColor(data.rank) }}>#{data.rank}위</div>}
                    <div className="text-xs text-gray-500 mt-1">글로벌 랭킹</div>
                  </div>
                ) : (
                  <div className="text-center text-gray-500 text-sm py-2">아직 랭킹이 없습니다</div>
                )}
                <div className="flex gap-3">
                  <div className="flex-1 rounded-2xl py-4 text-center" style={{ background: C.surfaceRaised }}>
                    <div className="text-xs text-gray-400 uppercase tracking-widest mb-1">최고 점수</div>
                    <div className="text-3xl font-bold" style={{ color: C.textPrimary }}>{data.bestScore ?? '-'}</div>
                  </div>
                  <div className="flex-1 rounded-2xl py-4 text-center" style={{ background: C.surfaceRaised }}>
                    <div className="text-xs text-gray-400 uppercase tracking-widest mb-1">플레이 횟수</div>
                    <div className="text-3xl font-bold" style={{ color: C.textPrimary }}>
                      {data.playCount}<span className="text-base font-semibold text-gray-400 ml-1">회</span>
                    </div>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-400 uppercase tracking-widest font-semibold mb-3">점수 히스토리</div>
                  <div className="rounded-2xl p-3" style={{ background: C.surfaceDim, border: `1px solid ${C.borderFaint}` }}>
                    <ScoreChart history={data.history} />
                  </div>
                  {data.history.length > 0 && (
                    <div className="text-xs text-gray-600 text-right mt-1.5">★ 최고점 &nbsp;• 최근 {data.history.length}게임</div>
                  )}
                </div>
              </>
            )}

            {tab === 'time' && (
              <>
                {data.timeAttackRank !== null ? (
                  <div className="text-center py-2">
                    <div className="text-5xl font-black" style={{ color: rankColor(data.timeAttackRank) }}>
                      {data.timeAttackRank <= 3 ? RANK_MEDALS[data.timeAttackRank] : null}
                      {data.timeAttackRank > 3 ? rankLabel(data.timeAttackRank) : null}
                    </div>
                    {data.timeAttackRank <= 3 && <div className="text-lg font-bold mt-1" style={{ color: rankColor(data.timeAttackRank) }}>#{data.timeAttackRank}위</div>}
                    <div className="text-xs text-gray-500 mt-1">글로벌 랭킹</div>
                  </div>
                ) : (
                  <div className="text-center text-gray-500 text-sm py-2">아직 랭킹이 없습니다</div>
                )}
                <div className="flex gap-3">
                  <div className="flex-1 rounded-2xl py-4 text-center" style={{ background: C.surfaceRaised }}>
                    <div className="text-xs text-gray-400 uppercase tracking-widest mb-1">최고 기록</div>
                    <div className="text-3xl font-bold" style={{ color: C.textPrimary }}>
                      {data.bestTimeSeconds !== null ? formatTime(data.bestTimeSeconds) : '-'}
                    </div>
                  </div>
                  <div className="flex-1 rounded-2xl py-4 text-center" style={{ background: C.surfaceRaised }}>
                    <div className="text-xs text-gray-400 uppercase tracking-widest mb-1">플레이 횟수</div>
                    <div className="text-3xl font-bold" style={{ color: C.textPrimary }}>
                      {data.timeAttackPlayCount}<span className="text-base font-semibold text-gray-400 ml-1">회</span>
                    </div>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-400 uppercase tracking-widest font-semibold mb-3">기록 히스토리</div>
                  <div className="rounded-2xl p-3" style={{ background: C.surfaceDim, border: `1px solid ${C.borderFaint}` }}>
                    <ScoreChart
                      history={data.timeAttackHistory.map(h => ({ score: h.time_seconds, played_at: h.played_at }))}
                      inverse
                      formatValue={formatTime}
                    />
                  </div>
                  {data.timeAttackHistory.length > 0 && (
                    <div className="text-xs text-gray-600 text-right mt-1.5">★ 최고기록 &nbsp;• 최근 {data.timeAttackHistory.length}게임 (낮을수록 좋음)</div>
                  )}
                </div>
              </>
            )}
          </>
        )}

        <button
          onClick={onClose}
          className="w-full py-3.5 rounded-2xl text-sm font-bold transition-all active:scale-95 mt-auto panel-hover"
          style={{ background: C.surfaceRaised, color: C.textSub }}
        >
          닫기
        </button>
      </div>
    </div>,
    document.body
  )
}
