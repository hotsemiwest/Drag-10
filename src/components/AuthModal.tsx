import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useAuthStore } from '../store/authStore'
import { checkDisplayNameTaken } from '../lib/supabase'
import { C } from '../theme/tokens'
import { SegmentedControl } from './SegmentedControl'
import { useIsPortrait } from '../hooks/useIsPortrait'

interface Props {
  onSuccess: () => void
  onClose: () => void
  onSignupDone?: () => void
  initialTab?: 'login' | 'signup'
  notice?: string
}

type Tab = 'login' | 'signup'

export function AuthModal({ onSuccess, onClose, onSignupDone, initialTab = 'login', notice }: Props) {
  const { signIn, signUp } = useAuthStore()
  const { isPortrait } = useIsPortrait()
  const [tab, setTab] = useState<Tab>(initialTab)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [nameError, setNameError] = useState('')
  const [nameAvailable, setNameAvailable] = useState(false)
  const [nameChecking, setNameChecking] = useState(false)
  const [signedUp, setSignedUp] = useState(false)
  const [internalNotice, setInternalNotice] = useState('')

  const activeNotice = notice ?? internalNotice

  async function handleNameBlur() {
    const trimmed = displayName.trim()
    if (!trimmed) return
    setNameChecking(true)
    const taken = await checkDisplayNameTaken(trimmed)
    setNameChecking(false)
    setNameError(taken ? '이미 사용 중인 닉네임입니다' : '')
    setNameAvailable(!taken)
  }

  async function handleSubmit() {
    setError('')
    if (!email.trim() || !password.trim()) return
    if (tab === 'signup' && !displayName.trim()) return
    if (tab === 'signup' && nameError) return
    setLoading(true)
    try {
      if (tab === 'signup') {
        await signUp(email.trim(), password, displayName.trim().slice(0, 16))
        setSignedUp(true)
      } else {
        await signIn(email.trim(), password)
        onSuccess()
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '오류가 발생했습니다'
      if (msg.includes('Invalid login')) setError('이메일 또는 비밀번호를 확인해 주세요')
      else if (msg.includes('already registered')) setError('이메일 또는 비밀번호를 확인해 주세요')
      else if (msg.includes('Password should')) setError('비밀번호는 6자 이상이어야 합니다')
      else setError('오류가 발생했습니다. 다시 시도해 주세요')
    } finally {
      setLoading(false)
    }
  }

  function handleGoToLogin() {
    setSignedUp(false)
    setTab('login')
    setInternalNotice('📧 인증 메일을 확인 후 로그인해 주세요.')
    setEmail('')
    setPassword('')
    onSignupDone?.()
  }

  function switchTab(t: Tab) {
    setTab(t)
    setError('')
    setNameError('')
    setNameAvailable(false)
    setInternalNotice('')
  }

  const sheetStyle: React.CSSProperties = isPortrait
    ? {
        width: '100%',
        borderRadius: '20px 20px 0 0',
        padding: '8px 20px 32px',
        background: C.surface,
        border: `1px solid ${C.borderStrong}`,
        borderBottom: 'none',
      }
    : {
        maxWidth: 360,
        width: 'calc(100% - 32px)',
        borderRadius: 24,
        padding: 24,
        background: C.surface,
        border: `1px solid ${C.borderStrong}`,
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
          <div style={{ width: 36, height: 4, borderRadius: 2, background: C.borderStrong, margin: '8px auto 16px' }} />
        )}

        {signedUp ? (
          <div className="text-center py-2">
            <div className="text-5xl mb-4">✉️</div>
            <p className="font-bold text-xl mb-2" style={{ color: C.textPrimary }}>인증 메일을 발송했습니다!</p>
            <p className="text-gray-400 text-sm mb-6 leading-relaxed">
              메일함에서 인증 링크를 클릭한 후<br />로그인해 주세요.
            </p>
            <button
              onClick={handleGoToLogin}
              className="w-full py-3.5 rounded-2xl text-sm font-bold text-white bg-gradient-to-r from-green-500 to-emerald-600 transition-all active:scale-95"
            >
              로그인하러 가기
            </button>
          </div>
        ) : (
          <>
            <div className="mb-5">
              <SegmentedControl
                options={[
                  { value: 'login', label: '로그인' },
                  { value: 'signup', label: '회원가입' },
                ]}
                value={tab}
                onChange={switchTab}
              />
            </div>

            {activeNotice && tab === 'login' && (
              <div
                className="rounded-xl px-4 py-2.5 mb-4 text-xs font-semibold text-green-300 text-center"
                style={{ background: C.noticeBg, border: `1px solid ${C.noticeBorder}` }}
              >
                {activeNotice}
              </div>
            )}

            <div className="space-y-3">
              {tab === 'signup' && (
                <div>
                  <input
                    type="text"
                    value={displayName}
                    onChange={e => { setDisplayName(e.target.value.slice(0, 16)); setNameError(''); setNameAvailable(false) }}
                    onBlur={handleNameBlur}
                    placeholder="닉네임 (최대 16자)"
                    className={`w-full rounded-xl px-4 py-3 text-sm outline-none border transition-colors ${nameError ? 'border-red-500' : 'input-adaptive'}`}
                    style={{ background: C.inputBg, color: C.textPrimary }}
                    autoFocus
                  />
                  {nameChecking && <p className="text-gray-400 text-xs mt-1 pl-1">확인 중...</p>}
                  {!nameChecking && nameError && <p className="text-red-400 text-xs mt-1 pl-1">{nameError}</p>}
                  {!nameChecking && nameAvailable && <p className="text-green-400 text-xs mt-1 pl-1">사용할 수 있는 닉네임입니다</p>}
                </div>
              )}
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="이메일"
                className="w-full rounded-xl px-4 py-3 text-sm outline-none border input-adaptive transition-colors"
                style={{ background: C.inputBg, color: C.textPrimary }}
                autoFocus={tab === 'login'}
              />
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                  placeholder="비밀번호 (6자 이상)"
                  className="w-full rounded-xl px-4 py-3 pr-12 text-sm outline-none border input-adaptive transition-colors"
                  style={{ background: C.inputBg, color: C.textPrimary }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition-colors text-xs font-semibold"
                >
                  {showPassword ? '숨기기' : '보기'}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-red-400 text-xs mt-3 text-center">{error}</p>
            )}

            <div className="flex gap-2 mt-4">
              <button
                onClick={onClose}
                className="flex-1 py-3.5 rounded-2xl text-sm font-semibold transition-all active:scale-95 panel-hover"
                style={{ background: C.surfaceRaised, color: C.textSub }}
              >
                취소
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="flex-1 py-3.5 rounded-2xl text-sm font-bold text-white bg-gradient-to-r from-green-500 to-emerald-600 transition-all active:scale-95 disabled:opacity-50"
              >
                {loading ? '처리 중...' : tab === 'login' ? '로그인' : '가입하기'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  )
}
