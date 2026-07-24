import type { RehearsalRecord } from '../types/domain'
import { MATERIAL_STATUS } from '../constants/enums'
import { DEFAULT_REHEARSAL_DURATION } from '../config/constants'
import { callImprovData } from './cloud'

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

export async function listRehearsals(
  filters: Record<string, unknown> = {},
  options: { silent?: boolean } = {}
): Promise<RehearsalRecord[]> {
  const data = await callImprovData<{ items: RehearsalRecord[] }>('rehearsal.list', filters, options)
  return (data.items || []).map(normalizeRehearsal)
}

export async function createRehearsal(payload: Partial<RehearsalRecord>) {
  return callImprovData<{ item: RehearsalRecord }>('rehearsal.create', payload as Record<string, unknown>)
}

export async function updateRehearsal(id: string, patch: Partial<RehearsalRecord>) {
  return callImprovData<{ item: RehearsalRecord }>('rehearsal.update', { id, patch } as Record<string, unknown>)
}

export async function updateMaterialStatus(payload: Record<string, unknown>) {
  return callImprovData<{ item: RehearsalRecord }>('rehearsal.updateMaterialStatus', payload)
}

export async function deleteRehearsal(id: string) {
  return callImprovData<{ id: string }>('rehearsal.delete', { id })
}

export async function completeRehearsal(payload: Record<string, unknown>) {
  return callImprovData<{ rehearsal: RehearsalRecord; methodCard?: unknown }>('rehearsal.complete', payload)
}
