import type { RehearsalRecord } from '../types/domain'
import { MATERIAL_STATUS } from '../constants/enums'
import { DEFAULT_REHEARSAL_DURATION } from '../config/constants'
import { callImprovAction } from './cloud'

export function normalizeRehearsal(raw: Partial<RehearsalRecord> & { _id?: string } = {}): RehearsalRecord {
  return Object.assign({
    id: raw._id || `rehearsal-${Date.now()}`,
    title: '',
    desc: '',
    teamName: '',
    duration: DEFAULT_REHEARSAL_DURATION,
    goals: [],
    source: 'recommended',
    status: '进行中',
    plan: [],
    meta: []
  }, raw) as RehearsalRecord
}

export function nextMaterialStatus(status: string): string {
  const index = MATERIAL_STATUS.indexOf(status)
  return MATERIAL_STATUS[(index + 1) % MATERIAL_STATUS.length]
}

export async function listRehearsals(filters: Record<string, unknown> = {}): Promise<RehearsalRecord[]> {
  const response = await callImprovAction<{ items: RehearsalRecord[] }>('rehearsal.list', filters)
  if (response.code === 0 && response.data && response.data.items) return response.data.items.map(normalizeRehearsal)
  throw new Error(response.message || '加载排练记录失败')
}

export async function createRehearsal(payload: Partial<RehearsalRecord>) {
  return callImprovAction('rehearsal.create', payload as Record<string, unknown>)
}

export async function updateRehearsal(id: string, patch: Partial<RehearsalRecord>) {
  return callImprovAction('rehearsal.update', { id, patch } as Record<string, unknown>)
}

export async function updateMaterialStatus(payload: Record<string, unknown>) {
  return callImprovAction('rehearsal.updateMaterialStatus', payload)
}

export async function deleteRehearsal(id: string) {
  return callImprovAction('rehearsal.delete', { id })
}
