import type {
  AppState,
  InspirationItem,
  Material,
  MaterialSession,
  MethodCardItem,
  PendingIntentMark,
  PracticeRecord,
  RehearsalPlanItem,
  RehearsalRecord,
  TodayItem
} from '../types/domain'

type Listener = (state: AppState) => void

const listeners: Listener[] = []
const DISMISSED_PENDING_KEYS_STORAGE = 'improv_dismissed_pending_keys'
const PENDING_INTENT_MARKS_STORAGE = 'improv_pending_intent_marks'
const THEME_MODE_STORAGE = 'improv_theme_mode'

const defaultState: AppState = {
  themeMode: 'default',
  viewMode: 'all',
  materials: [] as Material[],
  recommendMaterialId: '',
  savedMaterialIds: [] as string[],
  playedMaterialIds: [] as string[],
  todayInspirations: [] as InspirationItem[],
  todayRehearsals: [] as RehearsalRecord[],
  methodCards: [] as MethodCardItem[],
  pausedRehearsal: null,
  currentRehearsal: null,
  currentMaterial: null,
  rehearsalHistory: [] as RehearsalRecord[],
  practiceRecordsHistory: [] as PracticeRecord[],
  dismissedPendingKeys: [] as string[],
  pendingIntentMarks: [] as PendingIntentMark[],
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
    const pendingIntentMarks = wx.getStorageSync(PENDING_INTENT_MARKS_STORAGE)
    if (Array.isArray(pendingIntentMarks)) {
      initialState.pendingIntentMarks = pendingIntentMarks
        .map((item) => ({
          key: String((item && item.key) || '').trim(),
          intent: (item && item.intent === 'rehearsal' ? 'rehearsal' : 'training') as PendingIntentMark['intent']
        }))
        .filter((item) => item.key)
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
    wx.setStorageSync(PENDING_INTENT_MARKS_STORAGE, state.pendingIntentMarks || [])
  } catch (error) {
    // Ignore storage write failures for UI-only local preferences.
  }
}

function emit() {
  const snapshot = getState()
  listeners.slice().forEach((listener) => listener(snapshot))
}

export function getState(): AppState {
  const snapshot = clone(state) as AppState & Record<string, unknown>
  snapshot.games = snapshot.materials
  snapshot.recommendGameId = snapshot.recommendMaterialId
  snapshot.savedGameIds = snapshot.savedMaterialIds
  snapshot.playedGameIds = snapshot.playedMaterialIds
  snapshot.currentGame = snapshot.currentMaterial
  snapshot.gameRecordsHistory = snapshot.practiceRecordsHistory
  return snapshot as AppState
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

export function setMaterials(nextMaterials: Material[]) {
  const nextMaterialIds = new Set(nextMaterials.map((material) => material.id))
  const localCustomMaterials = state.materials.filter((material) => material.id.startsWith('custom-') && !nextMaterialIds.has(material.id))
  const mergedMaterials = localCustomMaterials.concat(nextMaterials)

  const saved = new Set(state.savedMaterialIds)
  const played = new Set(state.playedMaterialIds)
  setState({
    materials: mergedMaterials.map((material) => Object.assign({}, material, {
      saved: material.saved || saved.has(material.id),
      played: material.played || played.has(material.id)
    })),
    savedMaterialIds: mergedMaterials.filter((material) => material.saved || saved.has(material.id)).map((material) => material.id),
    playedMaterialIds: mergedMaterials.filter((material) => material.played || played.has(material.id)).map((material) => material.id)
  })
}

export function toggleSaved(materialId: string, value?: boolean) {
  const ids = new Set(state.savedMaterialIds)
  const nextValue = typeof value === 'boolean' ? value : !ids.has(materialId)
  if (nextValue) ids.add(materialId)
  else ids.delete(materialId)
  setState({
    savedMaterialIds: Array.from(ids),
    materials: state.materials.map((material) => material.id === materialId ? Object.assign({}, material, { saved: nextValue }) : material)
  })
  return nextValue
}

export function markPlayed(materialId: string) {
  const ids = new Set(state.playedMaterialIds)
  ids.add(materialId)
  setState({
    playedMaterialIds: Array.from(ids),
    materials: state.materials.map((material) => material.id === materialId ? Object.assign({}, material, {
      played: true,
      playedCount: (material.playedCount || 0) + 1
    }) : material)
  })
}

export function unmarkPlayed(materialId: string) {
  const ids = new Set(state.playedMaterialIds)
  ids.delete(materialId)
  setState({
    playedMaterialIds: Array.from(ids),
    materials: state.materials.map((material) => material.id === materialId ? Object.assign({}, material, {
      played: false,
      playedCount: Math.max(0, (material.playedCount || 0) - 1)
    }) : material)
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

export function setProfile(profile: { displayName: string; avatarUrl: string } | null) {
  setState({ profile })
}

export function setThemeMode(mode: 'default' | 'vivid') {
  setState({ themeMode: mode })
}

export function setRecommendMaterialId(recommendMaterialId: string) {
  setState({ recommendMaterialId })
}

export function setDismissedPendingKeys(dismissedPendingKeys: string[]) {
  setState({ dismissedPendingKeys })
}

export function setPendingIntentMarks(pendingIntentMarks: PendingIntentMark[]) {
  setState({ pendingIntentMarks })
}

export function toggleThemeMode() {
  setState({ themeMode: state.themeMode === 'default' ? 'vivid' : 'default' })
}

export function getThemeClass() {
  return state.themeMode === 'vivid' ? 'theme-vivid' : 'theme-default'
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

function getMaterialMutexLabel() {
  if (!state.currentMaterial) return ''
  return state.currentMaterial.status === '暂停中' ? '暂停中的素材练习' : '进行中的素材练习'
}

export function getTaskMutexError(target: 'rehearsal' | 'material') {
  if (target === 'rehearsal') {
    if (state.currentMaterial) return `当前有${getMaterialMutexLabel()}，请先结束后再开始排练`
    if (hasActiveRehearsal()) return `当前有${getRehearsalMutexLabel()}，请先结束后再开始排练`
    return ''
  }

  if (hasActiveRehearsal()) return `当前有${getRehearsalMutexLabel()}，请先结束后再开始素材练习`
  if (state.currentMaterial) return `当前有${getMaterialMutexLabel()}，请先结束后再开始素材练习`
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

export function setPracticeRecordsHistory(records: PracticeRecord[]) {
  setState({ practiceRecordsHistory: records })
}

export function addPracticeRecord(record: PracticeRecord) {
  setState({ practiceRecordsHistory: [record].concat(state.practiceRecordsHistory || []) })
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

export function startMaterialSession(session: MaterialSession) {
  const mutexError = getTaskMutexError('material')
  if (mutexError) throw new Error(mutexError)
  setState({ currentMaterial: session })
}

export function updateMaterialSession(patch: Partial<MaterialSession>) {
  if (state.currentMaterial) {
    setState({ currentMaterial: { ...state.currentMaterial, ...patch } })
  }
}

export function clearMaterialSession() {
  setState({ currentMaterial: null })
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

export function updateCurrentRehearsalPlan(materialId: string, patch: Partial<RehearsalPlanItem>) {
  const current = state.currentRehearsal
  if (!current) return null
  const plan = current.plan.map((item) => item.materialId === materialId ? Object.assign({}, item, patch) : item)
  const next = Object.assign({}, current, { plan })
  setState({
    currentRehearsal: next,
    rehearsalHistory: (state.rehearsalHistory || []).map((item) => item.id === next.id ? next : item),
    todayRehearsals: (state.todayRehearsals || []).map((item) => item.id === next.id ? next : item)
  })
  return next
}

export function addMaterialToCurrentRehearsal(materialId: string) {
  const current = state.currentRehearsal
  if (!current || current.plan.some((item) => item.materialId === materialId)) return current
  const nextPlan = current.plan.concat({
    materialId,
    status: '未开始',
    keep: '',
    try: ''
  } as RehearsalPlanItem)
  return patchCurrentRehearsal({ plan: nextPlan })
}

export function resetStoreForSeed(nextMaterials: Material[] = []) {
  state = Object.assign(clone(defaultState), {
    materials: nextMaterials,
    savedMaterialIds: nextMaterials.filter((material) => material.saved).map((material) => material.id),
    playedMaterialIds: nextMaterials.filter((material) => material.played).map((material) => material.id)
  })
  persist()
  emit()
}

export const setGames = setMaterials
export const setRecommendGameId = setRecommendMaterialId
export const setGameRecordsHistory = setPracticeRecordsHistory
export const addGameRecord = addPracticeRecord
export const startGameSession = startMaterialSession
export const updateGameSession = updateMaterialSession
export const clearGameSession = clearMaterialSession
export const addGameToCurrentRehearsal = addMaterialToCurrentRehearsal
