import type { Material } from '../types/domain'
import { callImprovAction } from './cloud'
import { getState } from '../store/index'
import { DEFAULT_SORT_ORDER } from '../config/constants'

export type MaterialListFilters = {
  query?: string
  type?: string
  ability?: string
  scene?: string
  status?: string
  limit?: number
}

export function normalizeMaterial(raw: Partial<Material> & { _id?: string }): Material {
  const id = raw.id || raw._id || 'unknown-material'
  const type = raw.type || '游戏'
  return Object.assign({
    id,
    title: '',
    desc: '',
    type,
    tags: [],
    abilities: [],
    scenes: [],
    meta: [],
    steps: [],
    tips: '',
    variant: '',
    issue: '',
    relatedMaterialId: '',
    referenceOnly: type === '路径',
    stripeTone: 'orange',
    sortOrder: DEFAULT_SORT_ORDER,
    saved: false,
    played: false,
    playedCount: 0
  }, raw, {
    id,
    type,
    relatedMaterialId: raw.relatedMaterialId || '',
    referenceOnly: typeof raw.referenceOnly === 'boolean' ? raw.referenceOnly : type === '路径',
    abilities: Array.isArray(raw.abilities) ? raw.abilities : [],
    scenes: Array.isArray(raw.scenes) ? raw.scenes : []
  }) as Material
}

export async function listMaterials(filters: MaterialListFilters = {}) {
  const response = await callImprovAction<{ items: Material[] }>('material.list', filters, { silent: true })
  if (response.code === 0 && response.data && response.data.items) {
    return response.data.items.map(normalizeMaterial).sort((a, b) => a.sortOrder - b.sortOrder)
  }
  throw new Error(response.message || '加载素材失败')
}

export async function createMaterial(payload: Partial<Material>) {
  return callImprovAction<{ id: string }>('material.create', payload as Record<string, unknown>)
}

export async function updateMaterial(payload: Partial<Material>) {
  return callImprovAction<{ materialId: string }>('material.update', payload as Record<string, unknown>)
}

export async function deleteMaterial(id: string) {
  return callImprovAction<{ materialId: string }>('material.delete', { id })
}

export async function updateMaterialState(materialId: string, patch: { saved?: boolean; played?: boolean }) {
  return callImprovAction<{ materialId: string }>('material.updateState', { materialId, ...patch })
}

export async function updateSaved(materialId: string, value: boolean) {
  return updateMaterialState(materialId, { saved: value })
}

export async function updatePlayed(materialId: string, value: boolean) {
  if (!value) return updateMaterialState(materialId, { played: false })
  return updateMaterialState(materialId, { played: true })
}

export function findLocalMaterial(id: string): Material | null {
  return getState().materials.find((material) => material.id === id) || null
}
