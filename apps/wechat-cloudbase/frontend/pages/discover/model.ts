import type { Material, MaterialType } from "../../types/domain"
import { MATERIAL_ABILITIES, MATERIAL_SCENES, MATERIAL_TYPES } from "../../config/material"

export const materialTypes = MATERIAL_TYPES
export const abilityOptions = MATERIAL_ABILITIES
export const sceneOptions = MATERIAL_SCENES

export function getCustomMaterialTags(categories: string[]) {
  return categories.filter((item) => (
    !materialTypes.includes(item as MaterialType)
    && !abilityOptions.includes(item)
    && !sceneOptions.includes(item)
  ))
}

export function buildRandomTagLabels(material: Material | null) {
  if (!material) return []
  const labels: string[] = [material.type, ...(material.abilities || []), ...(material.tags || [])]
  return Array.from(new Set(
    labels.map((item) => String(item || '').trim()).filter(Boolean)
  ))
}

export type NewMaterialDraft = Partial<Material> & {
  people?: string
  duration?: string
  steps?: string
}

export type CategoryCard = {
  type: MaterialType
  count: number
  tone: string
  hint: string
}

export type CategoryCardRow = {
  id: string
  items: CategoryCard[]
}

export type ExpandCardItem = {
  title: string
  desc: string
}

export type PathPreset = {
  key: string
  title: string
  desc: string
  preview: string[]
  abilities: string[]
  scenes: string[]
  steps: ExpandCardItem[]
  tips: string
  sortOrder: number
}

export type PathEntry = {
  key: string
  title: string
  desc: string
  preview: string[]
  customLabel: string
}

export type PathSheetState = {
  key: string
  title: string
  desc: string
  abilities: string[]
  scenes: string[]
  steps: ExpandCardItem[]
  tips: string
  customId: string
  editText: string
  saveText: string
}

export type PathDraft = {
  title: string
  desc: string
  steps: string
  abilityText: string
  tips: string
}

export const fabSizeRpx = 120
export const fabEdgeRpx = 28
export const fabBottomRpx = 154
export const fabTopGapRpx = 24
export const fabDragThreshold = 6
export const fabPositionStorageKey = 'improv_discover_fab_position'

export type FabWindow = {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

export type FabPositionPreference = {
  side: 'left' | 'right'
  yRatio: number
}

export function getFabPositionPreference(): FabPositionPreference | null {
  try {
    const value = wx.getStorageSync(fabPositionStorageKey)
    if (!value || (value.side !== 'left' && value.side !== 'right')) return null
    const yRatio = Number(value.yRatio)
    if (!Number.isFinite(yRatio)) return null
    return { side: value.side, yRatio: Math.min(1, Math.max(0, yRatio)) }
  } catch (error) {
    return null
  }
}
export const categoryHints: Record<MaterialType, string> = {
  游戏: '热身、短篇和限制玩法',
  角色: '身份、关系和状态素材',
  才艺: '模仿、身体和声音技能',
  格式: '短篇结构和长篇框架',
  主理: '主持词、带练和控场话术',
  技巧: 'Yes And、聆听和叙事能力',
  复盘: 'Keep、Try 和失败案例',
  路径: '训练地图和学习路线'
}
export const learningMapItems: ExpandCardItem[] = [
  { title: '入门基础', desc: 'Yes And、积极聆听、接住同伴。' },
  { title: '身体与声音', desc: '空间、节奏、状态、情绪。' },
  { title: '角色关系', desc: '身份、关系、目标、状态差。' },
  { title: '叙事结构', desc: '平台、打破常规、升级、回收。' },
  { title: '格式与主理', desc: '短篇玩法、长篇框架、控场话术、复盘。' }
]
export const trainingPathItems: ExpandCardItem[] = [
  { title: '个人热身', desc: '观察、联想、声音/身体启动。' },
  { title: '双人场景', desc: '接话、关系、情绪推进。' },
  { title: '小组排练', desc: '游戏组合、节奏控制、失败恢复。' },
  { title: '演出准备', desc: '开场、格式选择、主理提示。' },
  { title: '演后复盘', desc: 'Keep / Try、方法卡沉淀、下次提醒。' }
]
export const learningMapPreview = ['反应', '身体', '角色', '叙事', '主理']
export const trainingPathPreview = ['热身', '双人', '小组', '演出', '复盘']
export const pathPresets: PathPreset[] = [
  {
    key: 'learning-map',
    title: '学习地图',
    desc: '从基础反应到格式主理，按能力层层展开。',
    preview: learningMapPreview,
    abilities: ['自发性', '积极聆听', '身体空间', '角色塑造', '叙事构建', '主持'],
    scenes: ['备课'],
    steps: learningMapItems,
    tips: '学习地图用于查阅和自定义学习顺序，不进入训练计时。',
    sortOrder: 980
  },
  {
    key: 'training-path',
    title: '训练路径',
    desc: '从个人启动到演后复盘，形成一条可执行路线。',
    preview: trainingPathPreview,
    abilities: ['身体空间', '积极聆听', '团队协作', '主持', '失败复原'],
    scenes: ['备课', '排练'],
    steps: trainingPathItems,
    tips: '训练路径用于安排练习方向，具体练习仍从非路径素材开始。',
    sortOrder: 981
  }
]

export function buildMaterialMeta(people = '', duration = '') {
  return [people || '', duration || ''].filter(Boolean)
}

export function buildCategoryRows(cards: CategoryCard[]): CategoryCardRow[] {
  const rows: CategoryCardRow[] = []
  for (let index = 0; index < cards.length; index += 2) {
    rows.push({
      id: `category-row-${index}`,
      items: cards.slice(index, index + 2)
    })
  }
  return rows
}

export function buildFacetOptions(values: string[], counts: Record<string, number>, selected: string, labels: Record<string, string> = {}) {
  return [{ value: 'all', label: '全部' }].concat(values
    .filter((value) => value === selected || Number(counts[value]) > 0)
    .map((value) => ({ value, label: labels[value] || value })))
    .map((item) => ({
      ...item,
      activeClass: selected === item.value ? 'active' : ''
    }))
}

export function getPathPreset(key: string) {
  return pathPresets.find((preset) => preset.key === key) || pathPresets[0]
}

export function getCustomPathMaterial(materials: Material[], key: string) {
  return materials.find((material) => material.type === '路径' && material.relatedMaterialId === key) || null
}

export function splitPathText(value: string) {
  return String(value || '').split(/[,\n，、；;]+/).map((item) => item.trim()).filter(Boolean)
}

export function materialToPathSteps(material: Material | null, preset: PathPreset) {
  if (!material || !material.steps || !material.steps.length) return preset.steps
  return material.steps.map((step, index) => ({
    title: step,
    desc: preset.steps[index]?.desc || ''
  }))
}

export function buildPathEntries(materials: Material[]): PathEntry[] {
  return pathPresets.map((preset) => {
    const custom = getCustomPathMaterial(materials, preset.key)
    return {
      key: preset.key,
      title: custom?.title || preset.title,
      desc: custom?.desc || preset.desc,
      preview: custom?.steps && custom.steps.length ? custom.steps.slice(0, 5) : preset.preview,
      customLabel: custom ? '我的版本' : ''
    }
  })
}
