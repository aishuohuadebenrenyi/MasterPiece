import { callImprovData } from './cloud'

export type FeedbackCategory = 'bug' | 'suggestion' | 'content' | 'other'

export interface FeedbackPayload {
  category: FeedbackCategory
  content: string
  contact?: string
  sourcePage?: string
  appVersion?: string
}

export function createFeedback(payload: FeedbackPayload) {
  return callImprovData<{ item: { id: string } }>('feedback.create', payload as unknown as Record<string, unknown>)
}
