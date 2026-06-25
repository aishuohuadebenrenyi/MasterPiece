import type { Material } from '../types/domain'
import { callImprovData } from './cloud'
import { getState } from '../store/index'
import { DEFAULT_SORT_ORDER, MATERIAL_LIST_TIMEOUT_MS } from '../config/constants'
import { MATERIAL_TYPES } from '../config/material'

export type MaterialFacetCounts = Record<string, number>

export interface MaterialFacets {
  types: MaterialFacetCounts
  abilities: MaterialFacetCounts
  scenes: MaterialFacetCounts
  statuses: MaterialFacetCounts
}

export type MaterialListFilters = {
  query?: string
  type?: string
  ability?: string
  scene?: string
  status?: string
  limit?: number
  offset?: number
}

export interface MaterialListResult {
  items: Material[]
  total: number
  availableTotal: number
  categoryCounts: MaterialFacetCounts
  facets: MaterialFacets
  capacity?: { scanLimit: number; scanLimitReached: boolean }
  hasMore: boolean
  nextOffset: number | null
}

export function normalizeMaterial(raw: Partial<Material> & { _id?: string }): Material {
  const id = raw.id || raw._id || 'unknown-material'
  const type = raw.type as Material['type']
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
  const data = await listMaterialsPage(filters)
  return data.items
}

export async function listMaterialsPage(filters: MaterialListFilters = {}): Promise<MaterialListResult> {
  const data = await callImprovData<{ items: Material[]; total: number; availableTotal: number; categoryCounts: MaterialFacetCounts; facets: MaterialFacets; capacity?: { scanLimit: number; scanLimitReached: boolean }; hasMore: boolean; nextOffset: number | null }>('material.list', filters, {
    silent: true,
    timeoutMs: MATERIAL_LIST_TIMEOUT_MS
  })
  return {
    items: (data.items || []).filter((item) => MATERIAL_TYPES.includes(item.type)).map(normalizeMaterial).sort((a, b) => a.sortOrder - b.sortOrder),
    total: Number(data.total) || 0,
    availableTotal: Number(data.availableTotal) || 0,
    categoryCounts: data.categoryCounts || {},
    facets: data.facets || { types: {}, abilities: {}, scenes: {}, statuses: {} },
    capacity: data.capacity,
    hasMore: !!data.hasMore,
    nextOffset: typeof data.nextOffset === 'number' ? data.nextOffset : null
  }
}

export async function getMaterial(id: string) {
  const data = await callImprovData<{ item: Material }>('material.get', { id }, {
    silent: true,
    timeoutMs: MATERIAL_LIST_TIMEOUT_MS
  })
  return normalizeMaterial(data.item)
}

export async function createMaterial(payload: Partial<Material>) {
  return callImprovData<{ item: Material }>('material.create', payload as Record<string, unknown>)
}

export async function updateMaterial(payload: Partial<Material>) {
  return callImprovData<{ item: Material }>('material.update', payload as Record<string, unknown>)
}

export async function deleteMaterial(id: string) {
  return callImprovData<{ materialId: string }>('material.delete', { id })
}

export async function updateMaterialState(materialId: string, patch: { saved?: boolean; played?: boolean }) {
  return callImprovData<{ materialId: string }>('material.updateState', { materialId, ...patch })
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
