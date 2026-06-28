export type ViewMode = 'all' | 'category'
export type ThemeMode = 'default' | 'vivid'
export type StripeTone = 'orange' | 'blue' | 'mint'
export type RehearsalStatus = '未开始' | '进行中' | '已完成' | '暂停中'
export type MaterialSessionStatus = '进行中' | '暂停中' | '已完成'
export type MaterialType = '游戏' | '角色' | '才艺' | '格式' | '主理' | '技巧' | '复盘' | '路径'
export type PendingIntent = 'training' | 'rehearsal'
export type RecordCardLayoutKind = 'summary' | 'history'

export interface RecordCardViewModel {
  layoutKind: RecordCardLayoutKind
  eyebrow: string
  title: string
  bodyText: string
  metaPills: string[]
  pending: boolean
  badgeText: string
  badgeTone: StripeTone | 'orange'
  primaryActionText: string
  secondaryActionText: string
}

export interface MaterialSession {
  id: string
  materialId: string
  title: string
  startTime: number
  duration: number
  status: MaterialSessionStatus
}

export interface Material {
  _id?: string
  id: string
  ownerOpenId?: string
  title: string
  desc: string
  type: MaterialType
  tags: string[]
  abilities: string[]
  scenes: string[]
  meta: string[]
  steps: string[]
  tips: string
  variant: string
  issue: string
  relatedMaterialId: string
  referenceOnly?: boolean
  stripeTone: StripeTone
  sortOrder: number
  saved?: boolean
  played?: boolean
  playedCount?: number
  lastPlayedAt?: unknown
  lastRehearsalAt?: unknown
}

export interface TodayItem {
  id: string
  type?: string
  title: string
  desc: string
  status?: string
  meta?: string[]
  createdAt?: unknown
}

export interface PausedRehearsal {
  id: string
  title: string
  desc: string
}

export interface InspirationItem extends TodayItem {
  linkedMaterialId?: string
  linkedMaterialTitle?: string
  linkedRehearsalId?: string
  linkedRehearsalTitle?: string
}

export interface MethodCardItem extends TodayItem {
  sourceType?: string
}

export interface PendingIntentMark {
  key: string
  intent: PendingIntent
}

export interface RehearsalPlanItem {
  materialId: string
  status: RehearsalStatus
  keep: string
  try: string
}

export interface RehearsalRecord extends TodayItem {
  teamName: string
  duration: string
  goals: string[]
  source: string
  status: RehearsalStatus
  plan: RehearsalPlanItem[]
  reviewKeep?: string
  reviewTry?: string
  reviewReminder?: string
}

export interface PracticeRecord extends TodayItem {
  materialId: string
  rehearsalId?: string
  materialTitle?: string
  rehearsalTitle?: string
  score?: number
  note?: string
  attachments?: PracticeRecordAttachment[]
  reminder?: string
  duration?: number
}

export interface PracticeRecordAttachment {
  id: string
  type: 'image' | 'video'
  fileID: string
  thumbFileID?: string
  duration?: number
  size?: number
  createdAt?: unknown
}

export interface AppState {
  themeMode: ThemeMode
  viewMode: ViewMode
  materials: Material[]
  recommendMaterialId: string
  savedMaterialIds: string[]
  playedMaterialIds: string[]
  todayInspirations: InspirationItem[]
  todayRehearsals: RehearsalRecord[]
  methodCards: MethodCardItem[]
  pausedRehearsal: PausedRehearsal | null
  currentRehearsal: RehearsalRecord | null
  currentMaterial: MaterialSession | null
  rehearsalHistory: RehearsalRecord[]
  practiceRecordsHistory: PracticeRecord[]
  dismissedPendingKeys: string[]
  pendingIntentMarks: PendingIntentMark[]
  profile: { displayName: string; avatarUrl: string; troupeName?: string } | null
}

export interface CloudResponse<T> {
  code: number
  message: string
  data?: T | null
  requestId?: string
}
