import type {
  AppState,
  Game,
  GameSession,
  InspirationItem,
  MethodCardItem,
  RehearsalPlanItem,
  RehearsalRecord,
  TodayItem,
  VoiceDraft,
  GameRecord
} from '../types/domain'

type Listener = (state: AppState) => void

const listeners: Listener[] = []
const DISMISSED_PENDING_KEYS_STORAGE = 'improv_dismissed_pending_keys'
const THEME_MODE_STORAGE = 'improv_theme_mode'

const defaultState: AppState = {
  themeMode: 'default',
  viewMode: 'list',
  games: [] as Game[],
  recommendGameId: '',
  savedGameIds: [] as string[],
  playedGameIds: [] as string[],
  todayInspirations: [] as InspirationItem[],
  todayRehearsals: [] as RehearsalRecord[],
  methodCards: [] as MethodCardItem[],
  pausedRehearsal: null,
  currentRehearsal: null,
  currentGame: null,
  rehearsalHistory: [] as RehearsalRecord[],
  gameRecordsHistory: [] as GameRecord[],
  dismissedPendingKeys: [] as string[],
  voiceDraft: null,
  profile: null as { displayName: string; avatarUrl: string } | null
}

let state: AppState = readInitialState()

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

function readInitialState(): AppState {
  const initialState = clone(defaultState)
  try {
    const themeMode = wx.getStorageSync(THEME_MODE_STORAGE)
    if (themeMode === 'default' || themeMode === 'vivid') {
      initialState.themeMode = themeMode
    }
    const dismissedPendingKeys = wx.getStorageSync(DISMISSED_PENDING_KEYS_STORAGE)
    if (Array.isArray(dismissedPendingKeys)) {
      initialState.dismissedPendingKeys = dismissedPendingKeys
        .map((item) => String(item || '').trim())
        .filter(Boolean)
    }
  } catch (error) {
    // Ignore storage read failures and keep in-memory defaults.
  }
  return initialState
}

function persist() {
  try {
    wx.setStorageSync(THEME_MODE_STORAGE, state.themeMode)
    wx.setStorageSync(DISMISSED_PENDING_KEYS_STORAGE, state.dismissedPendingKeys || [])
  } catch (error) {
    // Ignore storage write failures for UI-only local preferences.
  }
}

function emit() {
  const snapshot = getState()
  listeners.slice().forEach((listener) => listener(snapshot))
}

export function getState(): AppState {
  return clone(state)
}

export function setState(patch: Partial<AppState>) {
  state = Object.assign({}, state, patch)
  persist()
  emit()
  return getState()
}

export function subscribe(listener: Listener) {
  listeners.push(listener)
  listener(getState())
  return () => {
    const index = listeners.indexOf(listener)
    if (index >= 0) listeners.splice(index, 1)
  }
}

export function setGames(nextGames: Game[]) {
  const nextGameIds = new Set(nextGames.map((g) => g.id))
  const localCustomGames = state.games.filter((g) => g.id.startsWith('custom-') && !nextGameIds.has(g.id))
  const mergedGames = localCustomGames.concat(nextGames)

  const saved = new Set(state.savedGameIds)
  const played = new Set(state.playedGameIds)
  setState({
    games: mergedGames.map((game) => Object.assign({}, game, {
      saved: game.saved || saved.has(game.id),
      played: game.played || played.has(game.id)
    })),
    savedGameIds: mergedGames.filter((game) => game.saved || saved.has(game.id)).map((game) => game.id),
    playedGameIds: mergedGames.filter((game) => game.played || played.has(game.id)).map((game) => game.id)
  })
}

export function toggleSaved(gameId: string, value?: boolean) {
  const ids = new Set(state.savedGameIds)
  const nextValue = typeof value === 'boolean' ? value : !ids.has(gameId)
  if (nextValue) ids.add(gameId)
  else ids.delete(gameId)
  setState({
    savedGameIds: Array.from(ids),
    games: state.games.map((game) => game.id === gameId ? Object.assign({}, game, { saved: nextValue }) : game)
  })
  return nextValue
}

export function markPlayed(gameId: string) {
  const ids = new Set(state.playedGameIds)
  ids.add(gameId)
  setState({
    playedGameIds: Array.from(ids),
    games: state.games.map((game) => game.id === gameId ? Object.assign({}, game, {
      played: true,
      playedCount: (game.playedCount || 0) + 1
    }) : game)
  })
}

export function unmarkPlayed(gameId: string) {
  const ids = new Set(state.playedGameIds)
  ids.delete(gameId)
  setState({
    playedGameIds: Array.from(ids),
    games: state.games.map((game) => game.id === gameId ? Object.assign({}, game, {
      played: false,
      playedCount: Math.max(0, (game.playedCount || 0) - 1)
    }) : game)
  })
}

export function addTodayItem(kind: 'todayInspirations' | 'todayRehearsals' | 'methodCards', item: TodayItem) {
  setState({ [kind]: [item].concat(state[kind] || []) } as Partial<AppState>)
}

export function addInspiration(item: InspirationItem) {
  setState({ todayInspirations: [item].concat(state.todayInspirations || []) })
}

export function upsertInspiration(item: InspirationItem) {
  setState({ todayInspirations: [item].concat((state.todayInspirations || []).filter((entry) => entry.id !== item.id)) })
}

export function addMethodCard(item: MethodCardItem) {
  setState({ methodCards: [item].concat(state.methodCards || []) })
}

export function setVoiceDraft(voiceDraft: VoiceDraft | null) {
  setState({ voiceDraft })
}

export function setProfile(profile: { displayName: string; avatarUrl: string } | null) {
  setState({ profile })
}

export function setThemeMode(mode: 'default' | 'vivid') {
  setState({ themeMode: mode })
}

export function setRecommendGameId(recommendGameId: string) {
  setState({ recommendGameId })
}

export function setDismissedPendingKeys(dismissedPendingKeys: string[]) {
  setState({ dismissedPendingKeys })
}

export function toggleThemeMode() {
  setState({ themeMode: state.themeMode === 'default' ? 'vivid' : 'default' })
}

export function getThemeClass() {
  return state.themeMode === 'vivid' ? 'theme-vivid' : 'theme-default'
}

export function clearVoiceDraft() {
  setState({ voiceDraft: null })
}

function buildPausedRehearsal(rehearsal: RehearsalRecord | null) {
  if (!rehearsal) return null
  return {
    id: rehearsal.id,
    title: rehearsal.title,
    desc: rehearsal.desc
  }
}

function hasActiveRehearsal() {
  return !!(state.currentRehearsal || state.pausedRehearsal)
}

function getRehearsalMutexLabel() {
  if (state.currentRehearsal?.status === '暂停中' || state.pausedRehearsal) return '暂停中的排练'
  if (state.currentRehearsal) return '进行中的排练'
  return ''
}

function getGameMutexLabel() {
  if (!state.currentGame) return ''
  return state.currentGame.status === '暂停中' ? '暂停中的游戏' : '进行中的游戏'
}

export function getTaskMutexError(target: 'rehearsal' | 'game') {
  if (target === 'rehearsal') {
    if (state.currentGame) return `当前有${getGameMutexLabel()}，请先结束后再开始排练`
    if (hasActiveRehearsal()) return `当前有${getRehearsalMutexLabel()}，请先结束后再开始排练`
    return ''
  }

  if (hasActiveRehearsal()) return `当前有${getRehearsalMutexLabel()}，请先结束后再开始游戏`
  if (state.currentGame) return `当前有${getGameMutexLabel()}，请先结束后再开始游戏`
  return ''
}

export function setCurrentRehearsal(rehearsal: RehearsalRecord | null) {
  setState({
    currentRehearsal: rehearsal,
    pausedRehearsal: rehearsal && rehearsal.status === '暂停中' ? buildPausedRehearsal(rehearsal) : null
  })
}

export function patchCurrentRehearsal(patch: Partial<RehearsalRecord>) {
  const current = state.currentRehearsal
  if (!current) return null
  const next = Object.assign({}, current, patch)
  setCurrentRehearsal(next)
  return next
}

export function setPausedRehearsal(rehearsal: RehearsalRecord | null) {
  setState({ pausedRehearsal: buildPausedRehearsal(rehearsal) })
}

export function clearPausedRehearsal() {
  setState({ pausedRehearsal: null })
}

export function upsertRehearsalHistory(rehearsal: RehearsalRecord) {
  const nextHistory = [rehearsal].concat((state.rehearsalHistory || []).filter((item) => item.id !== rehearsal.id))
  setState({
    rehearsalHistory: nextHistory,
    todayRehearsals: [rehearsal].concat((state.todayRehearsals || []).filter((item) => item.id !== rehearsal.id))
  })
}

export function setGameRecordsHistory(records: GameRecord[]) {
  setState({ gameRecordsHistory: records })
}

export function addGameRecord(record: GameRecord) {
  setState({ gameRecordsHistory: [record].concat(state.gameRecordsHistory || []) })
}

export function startRehearsal(rehearsal: RehearsalRecord) {
  const mutexError = getTaskMutexError('rehearsal')
  if (mutexError) throw new Error(mutexError)
  setState({
    currentRehearsal: rehearsal,
    pausedRehearsal: null,
    rehearsalHistory: [rehearsal].concat((state.rehearsalHistory || []).filter((item) => item.id !== rehearsal.id)),
    todayRehearsals: [rehearsal].concat((state.todayRehearsals || []).filter((item) => item.id !== rehearsal.id))
  })
}

export function startGameSession(session: GameSession) {
  const mutexError = getTaskMutexError('game')
  if (mutexError) throw new Error(mutexError)
  setState({ currentGame: session })
}

export function updateGameSession(patch: Partial<GameSession>) {
  if (state.currentGame) {
    setState({ currentGame: { ...state.currentGame, ...patch } })
  }
}

export function clearGameSession() {
  setState({ currentGame: null })
}

export function finishCurrentRehearsal(summaryPatch: Partial<RehearsalRecord> = {}) {
  if (!state.currentRehearsal) return null
  const finished = Object.assign({}, state.currentRehearsal, summaryPatch, { status: '已完成' as const }) as RehearsalRecord
  const rehearsalHistory = [finished, ...((state.rehearsalHistory || []).filter((item) => item.id !== finished.id))] as RehearsalRecord[]
  const todayRehearsals = [finished, ...((state.todayRehearsals || []).filter((item) => item.id !== finished.id))] as RehearsalRecord[]
  setState({
    currentRehearsal: null,
    pausedRehearsal: null,
    rehearsalHistory,
    todayRehearsals
  })
  return finished
}

export function updateCurrentRehearsalPlan(gameId: string, patch: Partial<RehearsalPlanItem>) {
  const current = state.currentRehearsal
  if (!current) return null
  const plan = current.plan.map((item) => item.gameId === gameId ? Object.assign({}, item, patch) : item)
  const next = Object.assign({}, current, { plan })
  setState({
    currentRehearsal: next,
    rehearsalHistory: (state.rehearsalHistory || []).map((item) => item.id === next.id ? next : item),
    todayRehearsals: (state.todayRehearsals || []).map((item) => item.id === next.id ? next : item)
  })
  return next
}

export function addGameToCurrentRehearsal(gameId: string) {
  const current = state.currentRehearsal
  if (!current || current.plan.some((item) => item.gameId === gameId)) return current
  const nextPlan = current.plan.concat({
    gameId,
    status: '未开始',
    keep: '',
    try: ''
  } as RehearsalPlanItem)
  return patchCurrentRehearsal({ plan: nextPlan })
}

export function resetStoreForSeed(nextGames: Game[] = []) {
  state = Object.assign(clone(defaultState), {
    games: nextGames,
    savedGameIds: nextGames.filter((game) => game.saved).map((game) => game.id),
    playedGameIds: nextGames.filter((game) => game.played).map((game) => game.id)
  })
  persist()
  emit()
}
