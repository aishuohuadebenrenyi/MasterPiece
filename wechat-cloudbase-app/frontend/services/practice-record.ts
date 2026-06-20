import type { PracticeRecord } from '../types/domain'
import { callImprovData } from './cloud'

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
    type: '素材练习'
  }, raw, {
    materialId: raw.materialId || ''
  }) as PracticeRecord
}

export async function listPracticeRecords(filters: Record<string, unknown> = {}): Promise<PracticeRecord[]> {
  const data = await callImprovData<{ items: PracticeRecord[] }>('practiceRecord.list', filters, { silent: true })
  return (data.items || []).map(normalizePracticeRecord)
}

export async function createPracticeRecord(payload: Partial<PracticeRecord>) {
  return callImprovData<{ item: PracticeRecord }>('practiceRecord.create', payload as Record<string, unknown>)
}

export async function updatePracticeRecord(id: string, patch: Partial<PracticeRecord>) {
  return callImprovData<{ item: PracticeRecord }>('practiceRecord.update', { id, patch } as Record<string, unknown>)
}

export async function deletePracticeRecord(id: string) {
  return callImprovData<{ id: string }>('practiceRecord.delete', { id })
}

export async function completePractice(payload: Record<string, unknown>) {
  return callImprovData<{ practiceRecord: PracticeRecord; rehearsal?: unknown; methodCard?: unknown }>('practice.complete', payload)
}
