export type ViewMode = 'list' | 'card'
export type VoiceTarget = 'inspiration' | 'game_feedback' | 'rehearsal'
export type StripeTone = 'orange' | 'blue' | 'mint'

export interface Game {
  _id?: string
  id: string
  title: string
  desc: string
  category: string
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
  createdAt?: unknown
}

export interface PausedRehearsal {
  id: string
  title: string
  desc: string
}

export interface AppState {
  viewMode: ViewMode
  games: Game[]
  savedGameIds: string[]
  playedGameIds: string[]
  todayInspirations: TodayItem[]
  todayRehearsals: TodayItem[]
  methodCards: TodayItem[]
  pausedRehearsal: PausedRehearsal | null
}

export interface CloudResponse<T> {
  code: number
  message: string
  data?: T | null
  requestId?: string
}
