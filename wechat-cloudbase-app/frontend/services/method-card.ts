import type { MethodCardItem } from '../types/domain'
import { callImprovAction } from './cloud'

export async function listMethodCards(filters: Record<string, unknown> = {}): Promise<MethodCardItem[]> {
  const response = await callImprovAction<{ items: MethodCardItem[] }>('methodCard.list', filters)
  if (response.code === 0 && response.data && response.data.items) return response.data.items
  throw new Error(response.message || '加载方法卡失败')
}

export async function createMethodCard(payload: Partial<MethodCardItem>) {
  return callImprovAction('methodCard.create', payload as Record<string, unknown>)
}

export async function updateMethodCard(id: string, patch: Partial<MethodCardItem>) {
  return callImprovAction('methodCard.update', { id, patch } as Record<string, unknown>)
}

export async function deleteMethodCard(id: string) {
  return callImprovAction('methodCard.delete', { id })
}
