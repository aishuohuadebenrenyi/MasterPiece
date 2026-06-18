import type { PracticeRecord } from '../types/domain'
import { callImprovAction } from './cloud'

export function normalizePracticeRecord(raw: Partial<PracticeRecord> & { _id?: string } = {}): PracticeRecord {
  return Object.assign({
    id: raw.id || raw._id || `practiceRecord-${Date.now()}`,
    materialId: raw.materialId || '',
    rehearsalId: '',
    title: '',
    desc: '',
    effect: '',
    keep: '',
    try: '',
    reminder: '',
    duration: 0,
    meta: [],
    type: '素材练习',
    syncStatus: 'synced'
  }, raw, {
    materialId: raw.materialId || ''
  }) as PracticeRecord
}

export async function listPracticeRecords(filters: Record<string, unknown> = {}): Promise<PracticeRecord[]> {
  const response = await callImprovAction<{ items: PracticeRecord[] }>('practiceRecord.list', filters, { silent: true })
  if (response.code === 0 && response.data && response.data.items) return response.data.items.map(normalizePracticeRecord)
  throw new Error(response.message || '加载练习记录失败')
}

export async function createPracticeRecord(payload: Partial<PracticeRecord>) {
  return callImprovAction('practiceRecord.create', payload as Record<string, unknown>)
}

export async function updatePracticeRecord(id: string, patch: Partial<PracticeRecord>) {
  return callImprovAction('practiceRecord.update', { id, patch } as Record<string, unknown>)
}

export async function deletePracticeRecord(id: string) {
  return callImprovAction('practiceRecord.delete', { id })
}
