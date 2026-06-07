import type { InspirationItem, RehearsalRecord } from '../types/domain'
import { callImprovAction } from './cloud'
import { getState, setState } from '../store/index'

export interface TodaySummary {
  inspirations: InspirationItem[]
  rehearsals: RehearsalRecord[]
  recommendGameId: string
}

export async function fetchTodaySummary() {
  const response = await callImprovAction<TodaySummary>('today.summary')
  if (response.code === 0 && response.data) {
    setState({
      todayInspirations: (response.data.inspirations || []) as InspirationItem[],
      todayRehearsals: (response.data.rehearsals || []) as RehearsalRecord[]
    })
    return response.data
  }
  const state = getState()
  return {
    inspirations: state.todayInspirations,
    rehearsals: state.todayRehearsals,
    recommendGameId: state.games[0]?.id || ''
  }
}
