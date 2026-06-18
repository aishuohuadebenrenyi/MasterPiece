import { callImprovAction } from './cloud'

export interface InspirationItem {
  id?: string
  title: string
  desc: string
  meta?: string[]
  linkedMaterialTitle?: string
  linkedRehearsalTitle?: string
  sourceType?: string
  sourceId?: string
  sourceTitle?: string
}

export async function listInspirations(filters: Record<string, unknown> = {}): Promise<InspirationItem[]> {
  const response = await callImprovAction<{ items: InspirationItem[] }>('inspiration.list', filters)
  if (response.code === 0 && response.data && response.data.items) return response.data.items
  throw new Error(response.message || '加载灵感失败')
}

export async function createInspiration(payload: InspirationItem): Promise<any> {
  return callImprovAction('inspiration.create', payload as unknown as Record<string, unknown>)
}

export async function updateInspiration(id: string, patch: Partial<InspirationItem>): Promise<any> {
  return callImprovAction('inspiration.update', { id, patch })
}

export async function deleteInspiration(id: string): Promise<any> {
  return callImprovAction('inspiration.delete', { id })
}
