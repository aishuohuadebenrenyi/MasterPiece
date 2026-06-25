const MATERIAL_TYPES = ['游戏', '角色', '才艺', '格式', '主理', '技巧', '复盘', '路径']
const MATERIAL_ABILITIES = ['自发性', 'Yes And', '积极聆听', '角色塑造', '情绪表达', '身体空间', '叙事构建', '失败复原', '主持', '团队协作']
const MATERIAL_SCENES = ['临场速查', '备课', '排练', '演出']
const MATERIAL_STATUSES = ['saved', 'played', 'unplayed']

function matchesMaterialStatus(material, status) {
  return !status || status === 'all'
    || (status === 'saved' && material.saved)
    || (status === 'played' && material.played)
    || (status === 'unplayed' && !material.played && !material.referenceOnly)
}

function matchesMaterialFilters(material, filters, ignoredDimension = '') {
  const abilities = Array.isArray(material.abilities) ? material.abilities : []
  const scenes = Array.isArray(material.scenes) ? material.scenes : []
  const tags = Array.isArray(material.tags) ? material.tags : []
  const meta = Array.isArray(material.meta) ? material.meta : []
  const inType = ignoredDimension === 'type' || !filters.type || filters.type === 'all' || material.type === filters.type
  const inAbility = ignoredDimension === 'ability' || !filters.ability || filters.ability === 'all' || abilities.includes(filters.ability)
  const inScene = ignoredDimension === 'scene' || !filters.scene || filters.scene === 'all' || scenes.includes(filters.scene)
  const inStatus = ignoredDimension === 'status' || matchesMaterialStatus(material, filters.status)
  const text = [material.title, material.desc, material.type, tags.join(' '), abilities.join(' '), scenes.join(' '), meta.join(' ')].join(' ').toLowerCase()
  return inType && inAbility && inScene && inStatus && (!filters.query || text.includes(filters.query))
}

function buildFacetCounts(materials, values, dimension, filters, matchesValue) {
  return values.reduce((counts, value) => {
    counts[value] = materials.filter(material => (
      matchesMaterialFilters(material, filters, dimension) && matchesValue(material, value)
    )).length
    return counts
  }, {})
}

function buildMaterialFacets(materials, filters) {
  return {
    types: buildFacetCounts(materials, MATERIAL_TYPES, 'type', filters, (material, value) => material.type === value),
    abilities: buildFacetCounts(materials, MATERIAL_ABILITIES, 'ability', filters, (material, value) => (material.abilities || []).includes(value)),
    scenes: buildFacetCounts(materials, MATERIAL_SCENES, 'scene', filters, (material, value) => (material.scenes || []).includes(value)),
    statuses: buildFacetCounts(materials, MATERIAL_STATUSES, 'status', filters, (material, value) => matchesMaterialStatus(material, value))
  }
}

function buildMaterialTypeCounts(materials) {
  return MATERIAL_TYPES.reduce((counts, type) => {
    counts[type] = materials.filter(material => material.type === type).length
    return counts
  }, {})
}

module.exports = {
  MATERIAL_TYPES,
  MATERIAL_ABILITIES,
  MATERIAL_SCENES,
  MATERIAL_STATUSES,
  matchesMaterialFilters,
  buildMaterialFacets,
  buildMaterialTypeCounts
}
