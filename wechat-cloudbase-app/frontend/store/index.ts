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
import { SESSION_EXPIRE_MS } from '../config/constants'

type Listener = (state: AppState) => void

const listeners: Listener[] = []
const DISMISSED_PENDING_KEYS_STORAGE = 'improv_dismissed_pending_keys'
const PENDING_INTENT_MARKS_STORAGE = 'improv_pending_intent_marks'
const THEME_MODE_STORAGE = 'improv_theme_mode'
const REHEARSAL_SESSION_STORAGE = 'improv_rehearsal_session'
const MATERIAL_SESSION_STORAGE = 'improv_material_session'

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

// 浅拷贝 state，避免深拷贝性能开销
function shallowClone<T>(value: T): T {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return Object.assign({}, value)
  }
  return value
}

function readInitialState(): AppState {
  const initialState = Object.assign({}, defaultState)
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
    // 从 Storage 恢复 session 数据
    const rehearsalRaw = wx.getStorageSync(REHEARSAL_SESSION_STORAGE)
    if (typeof rehearsalRaw === 'string' && rehearsalRaw) {
      const unwrapped = unwrapFromStorage(rehearsalRaw)
      if (unwrapped && isValidRehearsalRecord(unwrapped.data) && !isSessionExpired(unwrapped.savedAt)) {
        initialState.currentRehearsal = unwrapped.data as RehearsalRecord
        if ((unwrapped.data as RehearsalRecord).status === '暂停中') {
          initialState.pausedRehearsal = buildPausedRehearsal(unwrapped.data as RehearsalRecord)
        }
      } else {
        wx.removeStorageSync(REHEARSAL_SESSION_STORAGE)
      }
    }
    const materialRaw = wx.getStorageSync(MATERIAL_SESSION_STORAGE)
    if (typeof materialRaw === 'string' && materialRaw) {
      const unwrapped = unwrapFromStorage(materialRaw)
      if (unwrapped && isValidMaterialSession(unwrapped.data) && !isSessionExpired(unwrapped.savedAt)) {
        initialState.currentMaterial = unwrapped.data as MaterialSession
      } else {
        wx.removeStorageSync(MATERIAL_SESSION_STORAGE)
      }
    }
  } catch (_error) {
    // 忽略 Storage 读取失败，使用内存默认值
  }
  return initialState
}

function safeParseJSON(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch (_error) {
    return null
  }
}

function isValidRehearsalRecord(value: unknown): value is RehearsalRecord {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return (
    typeof record.id === 'string' && record.id !== '' &&
    typeof record.title === 'string' &&
    typeof record.status === 'string' &&
    Array.isArray(record.plan)
  )
}

function isValidMaterialSession(value: unknown): value is MaterialSession {
  if (!value || typeof value !== 'object') return false
  const session = value as Record<string, unknown>
  return (
    typeof session.id === 'string' && session.id !== '' &&
    typeof session.materialId === 'string' && session.materialId !== '' &&
    typeof session.status === 'string' &&
    typeof session.startTime === 'number'
  )
}

function isSessionExpired(savedAt: number): boolean {
  if (typeof savedAt !== 'number' || savedAt <= 0) return true
  return Date.now() - savedAt > SESSION_EXPIRE_MS
}

interface StorageWrapper {
  data: unknown
  savedAt: number
}

function wrapForStorage(data: unknown): string {
  return JSON.stringify({ data, savedAt: Date.now() } as StorageWrapper)
}

function unwrapFromStorage(raw: string): { data: unknown; savedAt: number } | null {
  const wrapper = safeParseJSON(raw)
  if (!wrapper || typeof wrapper !== 'object') return null
  const w = wrapper as Record<string, unknown>
  if (typeof w.savedAt !== 'number' || w.savedAt <= 0) return null
  return { data: w.data, savedAt: w.savedAt }
}

export function restoreSessions() {
  try {
    const rehearsalRaw = wx.getStorageSync(REHEARSAL_SESSION_STORAGE)
    if (typeof rehearsalRaw === 'string' && rehearsalRaw) {
      const unwrapped = unwrapFromStorage(rehearsalRaw)
      if (unwrapped && isValidRehearsalRecord(unwrapped.data) && !isSessionExpired(unwrapped.savedAt)) {
        state.currentRehearsal = unwrapped.data as RehearsalRecord
        if ((unwrapped.data as RehearsalRecord).status === '暂停中') {
          state.pausedRehearsal = buildPausedRehearsal(unwrapped.data as RehearsalRecord)
        }
      } else {
        wx.removeStorageSync(REHEARSAL_SESSION_STORAGE)
      }
    } else {
      wx.removeStorageSync(REHEARSAL_SESSION_STORAGE)
    }

    const materialRaw = wx.getStorageSync(MATERIAL_SESSION_STORAGE)
    if (typeof materialRaw === 'string' && materialRaw) {
      const unwrapped = unwrapFromStorage(materialRaw)
      if (unwrapped && isValidMaterialSession(unwrapped.data) && !isSessionExpired(unwrapped.savedAt)) {
        state.currentMaterial = unwrapped.data as MaterialSession
      } else {
        wx.removeStorageSync(MATERIAL_SESSION_STORAGE)
      }
    } else {
      wx.removeStorageSync(MATERIAL_SESSION_STORAGE)
    }

    emit()
  } catch (_error) {
    // 忽略 session 恢复过程中的 Storage 读取失败
  }
}

function persist() {
  try {
    wx.setStorageSync(THEME_MODE_STORAGE, state.themeMode)
    wx.setStorageSync(DISMISSED_PENDING_KEYS_STORAGE, state.dismissedPendingKeys || [])
    wx.setStorageSync(PENDING_INTENT_MARKS_STORAGE, state.pendingIntentMarks || [])
  } catch (_error) {
    // 忽略 UI 偏好设置的 Storage 写入失败
  }
}

function emit() {
  const snapshot = getState()
  listeners.slice().forEach((listener) => listener(snapshot))
}

// 返回 state 的浅拷贝，避免外部直接修改内部状态
export function getState(): AppState {
  return Object.assign({}, state)
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
  try {
    if (rehearsal && rehearsal.status !== '已完成') {
      wx.setStorageSync(REHEARSAL_SESSION_STORAGE, wrapForStorage(rehearsal))
    } else {
      wx.removeStorageSync(REHEARSAL_SESSION_STORAGE)
    }
  } catch (_error) {
    // 忽略 session 持久化的 Storage 写入失败
  }
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
  try {
    if (session) {
      wx.setStorageSync(MATERIAL_SESSION_STORAGE, wrapForStorage(session))
    }
  } catch (_error) {
    // 忽略 session 持久化的 Storage 写入失败
  }
}

export function updateMaterialSession(patch: Partial<MaterialSession>) {
  if (state.currentMaterial) {
    setState({ currentMaterial: { ...state.currentMaterial, ...patch } })
  }
}

export function clearMaterialSession() {
  setState({ currentMaterial: null })
  try {
    wx.removeStorageSync(MATERIAL_SESSION_STORAGE)
  } catch (_error) {
    // 忽略 session 持久化的 Storage 删除失败
  }
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
  try {
    wx.removeStorageSync(REHEARSAL_SESSION_STORAGE)
  } catch (_error) {
    // 忽略 session 持久化的 Storage 删除失败
  }
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
  state = Object.assign({}, defaultState, {
    materials: nextMaterials,
    savedMaterialIds: nextMaterials.filter((material) => material.saved).map((material) => material.id),
    playedMaterialIds: nextMaterials.filter((material) => material.played).map((material) => material.id)
  })
  persist()
  emit()
}
