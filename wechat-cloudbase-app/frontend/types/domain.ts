export type ViewMode = 'list' | 'card'
export type VoiceTarget = 'inspiration' | 'game_feedback' | 'rehearsal'
export type StripeTone = 'orange' | 'blue' | 'mint'
export type RehearsalStatus = '未开始' | '进行中' | '已完成' | '暂停中'
export type GameSessionStatus = '进行中' | '暂停中' | '已完成'

export interface GameSession {
  id: string
  gameId: string
  title: string
  startTime: number
  duration: number
  status: GameSessionStatus
}

export interface Game {
  _id?: string
  id: string
  title: string
  desc: string
  tags: string[]
  meta: string[]
  fit: string[]
  verdict?: string
  avoid?: string
  lead: string
  steps: string[]
  tips: string
  variant: string
  issue: string
  relatedGameId: string
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
  syncStatus?: 'pending' | 'synced'
  meta?: string[]
  createdAt?: unknown
}

export interface PausedRehearsal {
  id: string
  title: string
  desc: string
}

export interface InspirationItem extends TodayItem {
  linkedGameId?: string
  linkedGameTitle?: string
  linkedRehearsalId?: string
  linkedRehearsalTitle?: string
}

export interface MethodCardItem extends TodayItem {
  sourceType?: string
}

export interface RehearsalPlanItem {
  gameId: string
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
}

export interface GameRecord extends TodayItem {
  gameId: string
  rehearsalId?: string
  effect?: string
  keep?: string
  try?: string
  reminder?: string
  duration?: number
}

export interface VoiceDraft {
  id: string
  title: string
  desc: string
  summary: string
  target: VoiceTarget
  durationSeconds: number
  linkedGameId?: string
  linkedRehearsalId?: string
}

export interface AppState {
  viewMode: ViewMode
  games: Game[]
  savedGameIds: string[]
  playedGameIds: string[]
  todayInspirations: InspirationItem[]
  todayRehearsals: RehearsalRecord[]
  methodCards: MethodCardItem[]
  pausedRehearsal: PausedRehearsal | null
  currentRehearsal: RehearsalRecord | null
  currentGame: GameSession | null
  rehearsalHistory: RehearsalRecord[]
  gameRecordsHistory: GameRecord[]
  voiceDraft: VoiceDraft | null
  profile: { displayName: string; avatarUrl: string; troupeName?: string } | null
}

export interface CloudResponse<T> {
  code: number
  message: string
  data?: T | null
  requestId?: string
}
