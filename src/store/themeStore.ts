import { create } from 'zustand'
import {
  Theme, TileShape, TileColorId, ClearEffect,
  DEFAULT_THEME, DEFAULT_SHAPE, DEFAULT_COLOR, DEFAULT_EFFECT, TILE_COLORS,
} from '../theme/tokens'
import { DIFFICULTY_CONFIG, isValidDifficulty } from '../config/difficultyConfig'
import { upsertUserSettings } from '../lib/supabase'

interface ThemeState {
  theme: Theme
  tileShape: TileShape
  tileColorId: TileColorId
  showHintCount: boolean
  showDifficulty: boolean
  soloBoardDifficulty: number
  showDragSelectionSum: boolean
  showDragSelectionRangeColor: boolean
  devMode: boolean
  soundEnabled: boolean
  clearEffect: ClearEffect
  setTheme: (t: Theme) => void
  setTileShape: (s: TileShape) => void
  setTileColor: (id: TileColorId) => void
  setShowHintCount: (v: boolean) => void
  setShowDifficulty: (v: boolean) => void
  setSoloBoardDifficulty: (v: number) => void
  setShowDragSelectionSum: (v: boolean) => void
  setShowDragSelectionRangeColor: (v: boolean) => void
  setDevMode: (v: boolean) => void
  setSoundEnabled: (v: boolean) => void
  setClearEffect: (v: ClearEffect) => void
  applySettings: (s: Record<string, unknown>) => void
  reloadFromLocal: () => void
}

const KEY = 'drag10_theme'

type Saved = Pick<ThemeState, 'theme' | 'tileShape' | 'tileColorId' | 'showHintCount' | 'showDifficulty' | 'soloBoardDifficulty' | 'showDragSelectionSum' | 'showDragSelectionRangeColor' | 'devMode' | 'soundEnabled' | 'clearEffect'>

const THEMES: Theme[] = ['light', 'dark']
const TILE_SHAPES: TileShape[] = ['apple', 'circle', 'square', '8bit']
const CLEAR_EFFECTS: ClearEffect[] = ['particles', 'sword']

function validate(saved: Record<string, unknown>): Partial<Saved> {
  const result: Partial<Saved> = {}
  if (THEMES.includes(saved.theme as Theme)) result.theme = saved.theme as Theme
  if (TILE_SHAPES.includes(saved.tileShape as TileShape)) result.tileShape = saved.tileShape as TileShape
  if (TILE_COLORS.some(c => c.id === saved.tileColorId)) result.tileColorId = saved.tileColorId as TileColorId
  if (typeof saved.showHintCount === 'boolean') result.showHintCount = saved.showHintCount
  if (typeof saved.showDifficulty === 'boolean') result.showDifficulty = saved.showDifficulty
  if (isValidDifficulty(saved.soloBoardDifficulty as number)) result.soloBoardDifficulty = saved.soloBoardDifficulty as number
  if (typeof saved.showDragSelectionSum === 'boolean') result.showDragSelectionSum = saved.showDragSelectionSum
  if (typeof saved.showDragSelectionRangeColor === 'boolean') result.showDragSelectionRangeColor = saved.showDragSelectionRangeColor
  if (typeof saved.devMode === 'boolean') result.devMode = saved.devMode
  if (typeof saved.soundEnabled === 'boolean') result.soundEnabled = saved.soundEnabled
  if (CLEAR_EFFECTS.includes(saved.clearEffect as ClearEffect)) result.clearEffect = saved.clearEffect as ClearEffect
  return result
}

function load(): Partial<Saved> {
  try {
    return validate(JSON.parse(localStorage.getItem(KEY) ?? '{}'))
  } catch {
    return {}
  }
}

let dbSaveTimer: ReturnType<typeof setTimeout> | null = null

function save(patch: Partial<Saved>) {
  const merged = { ...load(), ...patch }
  try { localStorage.setItem(KEY, JSON.stringify(merged)) } catch {}
  if (dbSaveTimer) clearTimeout(dbSaveTimer)
  dbSaveTimer = setTimeout(() => { upsertUserSettings(merged).catch(() => {}) }, 500)
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: DEFAULT_THEME,
  tileShape: DEFAULT_SHAPE,
  tileColorId: DEFAULT_COLOR,
  showHintCount: true,
  showDifficulty: true,
  soloBoardDifficulty: DIFFICULTY_CONFIG.DEFAULT,
  showDragSelectionSum: true,
  showDragSelectionRangeColor: true,
  devMode: false,
  soundEnabled: true,
  clearEffect: DEFAULT_EFFECT,
  ...load(),

  setTheme:                       (theme)                        => { set({ theme });                        save({ theme }) },
  setTileShape:                   (tileShape)                    => { set({ tileShape });                    save({ tileShape }) },
  setTileColor:                   (tileColorId)                  => { set({ tileColorId });                  save({ tileColorId }) },
  setShowHintCount:               (showHintCount)                => { set({ showHintCount });                save({ showHintCount }) },
  setShowDifficulty:              (showDifficulty)               => { set({ showDifficulty });               save({ showDifficulty }) },
  setSoloBoardDifficulty:         (soloBoardDifficulty)          => { set({ soloBoardDifficulty });          save({ soloBoardDifficulty }) },
  setShowDragSelectionSum:        (showDragSelectionSum)         => { set({ showDragSelectionSum });         save({ showDragSelectionSum }) },
  setShowDragSelectionRangeColor: (showDragSelectionRangeColor)  => { set({ showDragSelectionRangeColor });  save({ showDragSelectionRangeColor }) },
  setDevMode:                     (devMode)                      => { set({ devMode });                      save({ devMode }) },
  setSoundEnabled:                (soundEnabled)                 => { set({ soundEnabled });                 save({ soundEnabled }) },
  setClearEffect:                 (clearEffect)                  => { set({ clearEffect });                  save({ clearEffect }) },

  applySettings: (s) => {
    set(validate(s))
  },

  reloadFromLocal: () => {
    set(validate(load() as Record<string, unknown>))
  },
}))
