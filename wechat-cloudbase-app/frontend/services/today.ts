import type { TodayItem } from '../types/domain'
import { callImprovAction } from './cloud'
import { getState, setState } from '../store/index'

export interface TodaySummary {
  inspirations: TodayItem[]
  rehearsals: TodayItem[]
  recommendGameId: string
}

export async function fetchTodaySummary() {
  const response = await callImprovAction<TodaySummary>('today.summary')
  if (response.code === 0 && response.data) {
    setState({
      todayInspirations: response.data.inspirations || [],
      todayRehearsals: response.data.rehearsals || []
    })
    return response.data
  }
  const state = getState()
  return {
    inspirations: state.todayInspirations,
    rehearsals: state.todayRehearsals,
    recommendGameId: 'status-swap'
  }
}
