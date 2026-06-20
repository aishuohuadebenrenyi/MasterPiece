import { callImprovData } from './cloud'

export interface InspirationItem {
  id?: string
  title: string
  desc: string
  meta?: string[]
  linkedMaterialTitle?: string
  linkedMaterialId?: string
  linkedRehearsalTitle?: string
  linkedRehearsalId?: string
  sourceType?: string
  sourceId?: string
  sourceTitle?: string
}

export async function listInspirations(filters: Record<string, unknown> = {}): Promise<InspirationItem[]> {
  const data = await callImprovData<{ items: InspirationItem[] }>('inspiration.list', filters)
  return data.items || []
}

export async function createInspiration(payload: InspirationItem): Promise<any> {
  return callImprovData<{ item: InspirationItem }>('inspiration.create', payload as unknown as Record<string, unknown>)
}

export async function updateInspiration(id: string, patch: Partial<InspirationItem>): Promise<any> {
  return callImprovData<{ item: InspirationItem }>('inspiration.update', { id, patch })
}

export async function deleteInspiration(id: string): Promise<any> {
  return callImprovData<{ id: string }>('inspiration.delete', { id })
}
