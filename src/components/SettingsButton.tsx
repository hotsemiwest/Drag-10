import { useState } from 'react'
import { C } from '../theme/tokens'
import { SettingsModal } from './SettingsModal'
import { useIsPortrait } from '../hooks/useIsPortrait'

export function SettingsButton() {
  const [open, setOpen] = useState(false)
  const { isPortrait } = useIsPortrait()

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`${isPortrait ? 'px-2 py-2 text-xs' : 'px-3 py-2 text-sm'} rounded-lg font-semibold transition-all active:scale-95`}
        style={{ background: C.surfaceRaised, color: C.textSub, border: `1px solid ${C.borderGhost}` }}
      >
        {isPortrait ? '⚙️' : '⚙️ 설정'}
      </button>
      {open && <SettingsModal onClose={() => setOpen(false)} />}
    </>
  )
}
