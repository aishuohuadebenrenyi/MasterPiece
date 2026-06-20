import type { InspirationItem, RehearsalRecord } from '../types/domain'
import { callImprovData } from './cloud'
import { setRecommendMaterialId, setState } from '../store/index'

export interface TodaySummary {
  inspirations: InspirationItem[]
  rehearsals: RehearsalRecord[]
  recommendMaterialId: string
}

export async function fetchTodaySummary() {
  const data = await callImprovData<TodaySummary>('today.summary')
  setState({
    todayInspirations: (data.inspirations || []) as InspirationItem[],
    todayRehearsals: (data.rehearsals || []) as RehearsalRecord[]
  })
  setRecommendMaterialId(data.recommendMaterialId || '')
  return data
}
