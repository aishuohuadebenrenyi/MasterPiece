import type { MethodCardItem } from '../types/domain'
import { callImprovData } from './cloud'

export async function listMethodCards(filters: Record<string, unknown> = {}): Promise<MethodCardItem[]> {
  const data = await callImprovData<{ items: MethodCardItem[] }>('methodCard.list', filters)
  return data.items || []
}

export async function createMethodCard(payload: Partial<MethodCardItem>) {
  return callImprovData<{ item: MethodCardItem }>('methodCard.create', payload as Record<string, unknown>)
}

export async function updateMethodCard(id: string, patch: Partial<MethodCardItem>) {
  return callImprovData<{ item: MethodCardItem }>('methodCard.update', { id, patch } as Record<string, unknown>)
}

export async function deleteMethodCard(id: string) {
  return callImprovData<{ id: string }>('methodCard.delete', { id })
}
