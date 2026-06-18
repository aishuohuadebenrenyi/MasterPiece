const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

// 数据库集合名称
const COLLECTIONS = {
  materials: 'improv_materials',
  userMaterialStates: 'improv_user_material_states',
  profiles: 'improv_profiles',
  inspirations: 'improv_inspirations',
  rehearsals: 'improv_rehearsals',
  practiceRecords: 'improv_practice_records',
  methodCards: 'improv_method_cards'
}

// 分页常量
const DEFAULT_LIMIT = 50
const MAX_LIMIT = 100
const TODAY_LIMIT = 20
const RECOMMEND_POOL_SIZE = 5

// 各集合允许写入的字段白名单
const FIELD_WHITELISTS = {
  inspirations: ['id', 'title', 'desc', 'meta', 'linkedMaterialTitle', 'linkedRehearsalTitle', 'sourceType', 'sourceId', 'sourceTitle'],
  methodCards: ['id', 'type', 'title', 'desc', 'meta', 'sourceType', 'sourceId', 'sourceTitle'],
  rehearsals: ['id', 'title', 'desc', 'plan', 'status', 'keep', 'try'],
  practiceRecords: ['id', 'materialId', 'materialTitle', 'feedback', 'keep', 'try', 'duration', 'rating'],
  profiles: ['id', 'displayName', 'avatarUrl', 'troupeName']
}

// 各集合允许更新的字段白名单
const UPDATE_WHITELISTS = {
  inspirations: ['title', 'desc', 'meta', 'linkedMaterialTitle', 'linkedRehearsalTitle', 'sourceType', 'sourceId', 'sourceTitle'],
  methodCards: ['type', 'title', 'desc', 'meta', 'sourceType', 'sourceId', 'sourceTitle'],
  rehearsals: ['title', 'desc', 'plan', 'status', 'keep', 'try'],
  practiceRecords: ['materialId', 'materialTitle', 'feedback', 'keep', 'try', 'duration', 'rating']
}

function ok(data = {}, requestId = '') {
  return { code: 0, message: 'ok', data, requestId }
}

function fail(message, requestId = '', code = -1) {
  return { code, message, data: null, requestId }
}

function now() {
  return db.serverDate()
}

function getOpenId() {
  return cloud.getWXContext().OPENID
}

function ownerWhere(extra = {}) {
  return Object.assign({
    ownerOpenId: getOpenId(),
    deletedAt: null
  }, extra)
}

// 从 payload 中只提取白名单中的字段
function pickFields(payload, whitelist) {
  const result = {}
  for (const key of whitelist) {
    if (payload[key] !== undefined) {
      result[key] = payload[key]
    }
  }
  return result
}

function normalizeMaterialPayload(payload, ownerOpenId) {
  const type = payload.type || '游戏'
  return {
    id: payload.id || `custom-${Date.now()}`,
    title: payload.title,
    desc: payload.desc || '',
    type,
    tags: Array.isArray(payload.tags) ? payload.tags : ['自定义'],
    abilities: Array.isArray(payload.abilities) ? payload.abilities : [],
    scenes: Array.isArray(payload.scenes) ? payload.scenes : [],
    meta: Array.isArray(payload.meta) ? payload.meta : [],
    steps: Array.isArray(payload.steps) ? payload.steps : [],
    tips: payload.tips || '',
    variant: payload.variant || '',
    issue: payload.issue || '',
    relatedMaterialId: payload.relatedMaterialId || '',
    referenceOnly: typeof payload.referenceOnly === 'boolean' ? payload.referenceOnly : type === '路径',
    stripeTone: payload.stripeTone || 'orange',
    sortOrder: Number(payload.sortOrder) || 999,
    ownerOpenId,
    createdAt: now(),
    updatedAt: now(),
    deletedAt: null
  }
}

async function listMaterials(payload, requestId) {
  const ownerOpenId = getOpenId()
  const limit = Math.min(Number(payload.limit) || DEFAULT_LIMIT, MAX_LIMIT)
  const type = typeof payload.type === 'string' ? payload.type.trim() : ''
  const query = typeof payload.query === 'string' ? payload.query.trim().toLowerCase() : ''
  const ability = typeof payload.ability === 'string' ? payload.ability.trim() : ''
  const scene = typeof payload.scene === 'string' ? payload.scene.trim() : ''
  const status = typeof payload.status === 'string' ? payload.status.trim() : ''
  const visibleOwners = ownerOpenId ? ['system', ownerOpenId] : ['system']
  const materialWhere = Object.assign(
    { deletedAt: null, ownerOpenId: _.in(visibleOwners) },
    type && type !== 'all' ? { type } : {}
  )
  const materialsResult = await db.collection(COLLECTIONS.materials)
    .where(materialWhere)
    .orderBy('sortOrder', 'asc')
    .limit(limit)
    .get()

  // 无 OPENID 时（如云控制台测试）跳过用户状态合并
  const statesResult = ownerOpenId
    ? await db.collection(COLLECTIONS.userMaterialStates)
      .where({ ownerOpenId })
      .limit(MAX_LIMIT)
      .get()
    : { data: [] }

  const states = statesResult.data.reduce((map, item) => {
    map[item.materialId] = item
    return map
  }, {})
  const items = materialsResult.data.map((material) => {
    const state = states[material.id] || {}
    return Object.assign({}, material, {
      saved: !!state.saved,
      played: !!state.playedCount,
      playedCount: state.playedCount || 0,
      lastPlayedAt: state.lastPlayedAt || null,
      lastRehearsalAt: state.lastRehearsalAt || null
    })
  }).filter((material) => {
    const abilities = Array.isArray(material.abilities) ? material.abilities : []
    const scenes = Array.isArray(material.scenes) ? material.scenes : []
    const tags = Array.isArray(material.tags) ? material.tags : []
    const meta = Array.isArray(material.meta) ? material.meta : []
    const inAbility = !ability || ability === 'all' || abilities.includes(ability) || tags.includes(ability)
    const inScene = !scene || scene === 'all' || scenes.includes(scene) || tags.includes(scene)
    const inStatus = !status || status === 'all'
      || (status === 'saved' && material.saved)
      || (status === 'played' && material.played)
      || (status === 'unplayed' && !material.played && !material.referenceOnly)
    const text = [
      material.title,
      material.desc,
      material.type,
      tags.join(' '),
      abilities.join(' '),
      scenes.join(' '),
      meta.join(' ')
    ].join(' ').toLowerCase()
    return inAbility && inScene && inStatus && (!query || text.includes(query))
  })
  return ok({ items }, requestId)
}

async function createMaterial(payload, requestId) {
  if (!payload.title) return fail('缺少素材名称', requestId, 400)
  const ownerOpenId = getOpenId()
  const doc = normalizeMaterialPayload(payload, ownerOpenId)
  const result = await db.collection(COLLECTIONS.materials).add({ data: doc })
  return ok({ id: result._id, materialId: doc.id }, requestId)
}

async function updateMaterial(payload, requestId) {
  if (!payload.id) return fail('缺少素材 ID', requestId, 400)
  if (!payload.title) return fail('缺少素材名称', requestId, 400)
  const ownerOpenId = getOpenId()

  const collection = db.collection(COLLECTIONS.materials)
  const existing = await collection.where({ id: payload.id, ownerOpenId, deletedAt: null }).limit(1).get()
  if (!existing.data.length) return fail('素材不存在或无权限修改', requestId, 404)

  const doc = normalizeMaterialPayload(payload, ownerOpenId)
  delete doc.id
  delete doc.createdAt
  doc.updatedAt = now()

  await collection.doc(existing.data[0]._id).update({ data: doc })
  return ok({ materialId: payload.id }, requestId)
}

async function deleteMaterial(payload, requestId) {
  if (!payload.id) return fail('缺少素材 ID', requestId, 400)
  const ownerOpenId = getOpenId()

  const collection = db.collection(COLLECTIONS.materials)
  const existing = await collection.where({ id: payload.id, ownerOpenId, deletedAt: null }).limit(1).get()
  if (!existing.data.length) return fail('素材不存在或无权限删除', requestId, 404)

  await collection.doc(existing.data[0]._id).update({ data: { deletedAt: now() } })
  return ok({ materialId: payload.id }, requestId)
}

async function updateMaterialState(payload, requestId) {
  const ownerOpenId = getOpenId()
  const materialId = payload.materialId
  if (!materialId) return fail('缺少 materialId', requestId, 400)
  const collection = db.collection(COLLECTIONS.userMaterialStates)
  const existing = await collection.where({ ownerOpenId, materialId }).limit(1).get()
  const patch = { updatedAt: now() }
  if (typeof payload.saved === 'boolean') patch.saved = payload.saved
  if (payload.played === true) {
    patch.playedCount = _.inc(1)
    patch.lastPlayedAt = now()
  }
  if (payload.played === false) {
    patch.playedCount = 0
    patch.lastPlayedAt = null
  }
  if (payload.lastRehearsalAt) patch.lastRehearsalAt = now()

  if (existing.data.length) {
    await collection.doc(existing.data[0]._id).update({ data: patch })
    return ok({ materialId }, requestId)
  }

  await collection.add({
    data: Object.assign({
      ownerOpenId,
      materialId,
      saved: !!payload.saved,
      playedCount: payload.played ? 1 : 0,
      lastPlayedAt: payload.played ? now() : null,
      lastRehearsalAt: payload.lastRehearsalAt ? now() : null,
      createdAt: now()
    }, patch)
  })
  return ok({ materialId }, requestId)
}

async function listOwned(collectionName, payload, requestId) {
  const limit = Math.min(Number(payload.limit) || DEFAULT_LIMIT, MAX_LIMIT)
  const result = await db.collection(collectionName)
    .where(ownerWhere())
    .orderBy('updatedAt', 'desc')
    .limit(limit)
    .get()
  return ok({ items: result.data }, requestId)
}

async function createOwned(collectionName, payload, requestId) {
  const whitelist = FIELD_WHITELISTS[collectionName]
  const safeData = whitelist ? pickFields(payload, whitelist) : payload
  const result = await db.collection(collectionName).add({
    data: Object.assign({}, safeData, {
      ownerOpenId: getOpenId(),
      createdAt: now(),
      updatedAt: now(),
      deletedAt: null
    })
  })
  return ok({ id: result._id }, requestId)
}

async function deleteOwned(collectionName, payload, requestId) {
  if (!payload.id) return fail('缺少 id', requestId, 400)
  const collection = db.collection(collectionName)
  const result = await collection.where(ownerWhere({ id: payload.id })).limit(1).get()
  if (!result.data.length) return fail('未找到记录', requestId, 404)
  await collection.doc(result.data[0]._id).update({ data: { deletedAt: now() } })
  return ok({ id: payload.id }, requestId)
}

async function updateOwned(collectionName, payload, requestId) {
  if (!payload.id) return fail('缺少 id', requestId, 400)
  const collection = db.collection(collectionName)
  const result = await collection.where(ownerWhere({ id: payload.id })).limit(1).get()
  if (!result.data.length) return fail('未找到记录', requestId, 404)
  const whitelist = UPDATE_WHITELISTS[collectionName]
  const rawPatch = payload.patch || {}
  const safePatch = whitelist ? pickFields(rawPatch, whitelist) : rawPatch
  const patch = Object.assign({}, safePatch, { updatedAt: now() })
  await collection.doc(result.data[0]._id).update({ data: patch })
  return ok({ id: payload.id }, requestId)
}

async function getProfile(requestId) {
  const result = await db.collection(COLLECTIONS.profiles)
    .where(ownerWhere())
    .limit(1)
    .get()
  return ok({ item: result.data[0] || null }, requestId)
}

async function updateProfile(payload, requestId) {
  const displayName = typeof payload.displayName === 'string' ? payload.displayName.trim() : ''
  const avatarUrl = typeof payload.avatarUrl === 'string' ? payload.avatarUrl.trim() : ''
  const troupeName = typeof payload.troupeName === 'string' ? payload.troupeName.trim() : ''
  if (!displayName) return fail('缺少 displayName', requestId, 400)

  const collection = db.collection(COLLECTIONS.profiles)
  const existing = await collection.where(ownerWhere()).limit(1).get()
  const patch = {
    displayName,
    avatarUrl,
    troupeName,
    updatedAt: now()
  }

  if (existing.data.length) {
    await collection.doc(existing.data[0]._id).update({ data: patch })
    return ok({ item: Object.assign({}, existing.data[0], patch) }, requestId)
  }

  const profile = Object.assign({}, patch, {
    id: `profile-${Date.now()}`,
    ownerOpenId: getOpenId(),
    createdAt: now(),
    deletedAt: null
  })
  const result = await collection.add({ data: profile })
  return ok({ item: Object.assign({ _id: result._id }, profile) }, requestId)
}

async function updateRehearsalMaterialStatus(payload, requestId) {
  const materialId = payload.materialId
  if (!payload.rehearsalId || !materialId) return fail('缺少 rehearsalId 或 materialId', requestId, 400)
  const collection = db.collection(COLLECTIONS.rehearsals)
  const result = await collection.where(ownerWhere({ id: payload.rehearsalId })).limit(1).get()
  if (!result.data.length) return fail('未找到排练记录', requestId, 404)
  const rehearsal = result.data[0]
  const currentPlan = Array.isArray(rehearsal.plan) ? rehearsal.plan : []
  const plan = currentPlan.map((item) => item.materialId === materialId
    ? Object.assign({}, item, {
        materialId,
        status: payload.status || item.status,
        keep: typeof payload.keep === 'string' ? payload.keep : item.keep || '',
        try: typeof payload.try === 'string' ? payload.try : item.try || ''
      })
    : item)
  await collection.doc(rehearsal._id).update({
    data: {
      plan,
      status: payload.rehearsalStatus || rehearsal.status || '进行中',
      updatedAt: now()
    }
  })
  return ok({ rehearsalId: payload.rehearsalId, materialId }, requestId)
}

async function todaySummary(requestId) {
  const ownerOpenId = getOpenId()
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const [inspirations, rehearsals, unplayedMaterials] = await Promise.all([
    db.collection(COLLECTIONS.inspirations).where({
      ownerOpenId,
      deletedAt: null,
      createdAt: _.gte(start)
    }).orderBy('createdAt', 'desc').limit(TODAY_LIMIT).get(),
    db.collection(COLLECTIONS.rehearsals).where({
      ownerOpenId,
      deletedAt: null,
      createdAt: _.gte(start)
    }).orderBy('createdAt', 'desc').limit(TODAY_LIMIT).get(),
    ownerOpenId
      ? db.collection(COLLECTIONS.materials).where({
          deletedAt: null,
          ownerOpenId: 'system',
          referenceOnly: _.neq(true)
        }).orderBy('sortOrder', 'asc').limit(TODAY_LIMIT).get()
      : { data: [] }
  ])

  let recommendMaterialId = ''
  if (ownerOpenId && unplayedMaterials.data.length) {
    const statesResult = await db.collection(COLLECTIONS.userMaterialStates)
      .where({ ownerOpenId })
      .limit(MAX_LIMIT)
      .get()
    const playedIds = new Set(statesResult.data.filter(s => s.playedCount > 0).map(s => s.materialId))
    const unplayed = unplayedMaterials.data.filter(m => !playedIds.has(m.id))
    if (unplayed.length) {
      const idx = Math.floor(Math.random() * Math.min(unplayed.length, RECOMMEND_POOL_SIZE))
      recommendMaterialId = unplayed[idx].id
    }
  }
  if (!recommendMaterialId && unplayedMaterials.data.length) {
    recommendMaterialId = unplayedMaterials.data[0].id
  }

  return ok({
    inspirations: inspirations.data,
    rehearsals: rehearsals.data,
    recommendMaterialId
  }, requestId)
}

// 路由表
const routes = {
  'material.list': (payload, requestId) => listMaterials(payload, requestId),
  'material.create': (payload, requestId) => createMaterial(payload, requestId),
  'material.update': (payload, requestId) => updateMaterial(payload, requestId),
  'material.delete': (payload, requestId) => deleteMaterial(payload, requestId),
  'material.updateState': (payload, requestId) => updateMaterialState(payload, requestId),
  'profile.get': (_payload, requestId) => getProfile(requestId),
  'profile.update': (payload, requestId) => updateProfile(payload, requestId),
  'today.summary': (_payload, requestId) => todaySummary(requestId),
  'inspiration.list': (payload, requestId) => listOwned(COLLECTIONS.inspirations, payload, requestId),
  'inspiration.create': (payload, requestId) => createOwned(COLLECTIONS.inspirations, payload, requestId),
  'inspiration.update': (payload, requestId) => updateOwned(COLLECTIONS.inspirations, payload, requestId),
  'inspiration.delete': (payload, requestId) => deleteOwned(COLLECTIONS.inspirations, payload, requestId),
  'methodCard.list': (payload, requestId) => listOwned(COLLECTIONS.methodCards, payload, requestId),
  'methodCard.create': (payload, requestId) => createOwned(COLLECTIONS.methodCards, payload, requestId),
  'methodCard.update': (payload, requestId) => updateOwned(COLLECTIONS.methodCards, payload, requestId),
  'methodCard.delete': (payload, requestId) => deleteOwned(COLLECTIONS.methodCards, payload, requestId),
  'rehearsal.list': (payload, requestId) => listOwned(COLLECTIONS.rehearsals, payload, requestId),
  'rehearsal.create': (payload, requestId) => createOwned(COLLECTIONS.rehearsals, payload, requestId),
  'rehearsal.update': (payload, requestId) => updateOwned(COLLECTIONS.rehearsals, payload, requestId),
  'rehearsal.delete': (payload, requestId) => deleteOwned(COLLECTIONS.rehearsals, payload, requestId),
  'rehearsal.updateMaterialStatus': (payload, requestId) => updateRehearsalMaterialStatus(payload, requestId),
  'practiceRecord.list': (payload, requestId) => listOwned(COLLECTIONS.practiceRecords, payload, requestId),
  'practiceRecord.create': (payload, requestId) => createOwned(COLLECTIONS.practiceRecords, payload, requestId),
  'practiceRecord.update': (payload, requestId) => updateOwned(COLLECTIONS.practiceRecords, payload, requestId),
  'practiceRecord.delete': (payload, requestId) => deleteOwned(COLLECTIONS.practiceRecords, payload, requestId)
}

exports.main = async (event) => {
  const action = event.action
  const payload = event.payload || {}
  const requestId = event.requestId || ''

  const handler = routes[action]
  if (!handler) {
    return fail(`未知 action: ${action}`, requestId, 404)
  }

  try {
    return await handler(payload, requestId)
  } catch (error) {
    console.error('[improv-api:error]', action, error)
    const message = error && error.errCode
      ? `云开发错误: ${error.errCode}`
      : '服务暂不可用，请稍后再试'
    return fail(message, requestId, 500)
  }
}
