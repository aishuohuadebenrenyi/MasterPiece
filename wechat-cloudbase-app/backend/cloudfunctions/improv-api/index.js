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
  methodCards: 'improv_method_cards',
  feedback: 'improv_feedback'
}

// 分页常量
const DEFAULT_LIMIT = 50
const MAX_LIMIT = 100
const MAX_MATERIAL_SCAN = 500
const TODAY_LIMIT = 20
const RECOMMEND_POOL_SIZE = 5

// 各集合允许写入的字段白名单
const FIELD_WHITELISTS = {
  [COLLECTIONS.inspirations]: ['id', 'title', 'desc', 'meta', 'linkedMaterialId', 'linkedMaterialTitle', 'linkedRehearsalId', 'linkedRehearsalTitle', 'sourceType', 'sourceId', 'sourceTitle'],
  [COLLECTIONS.methodCards]: ['id', 'type', 'title', 'desc', 'meta', 'sourceType', 'sourceId', 'sourceTitle'],
  [COLLECTIONS.rehearsals]: ['id', 'title', 'desc', 'teamName', 'duration', 'goals', 'source', 'status', 'plan', 'reviewKeep', 'reviewTry', 'reviewReminder', 'meta'],
  [COLLECTIONS.practiceRecords]: ['id', 'materialId', 'materialTitle', 'rehearsalId', 'rehearsalTitle', 'title', 'desc', 'effect', 'keep', 'try', 'reminder', 'duration', 'meta'],
  [COLLECTIONS.profiles]: ['id', 'displayName', 'avatarUrl', 'troupeName']
}

// 各集合允许更新的字段白名单
const UPDATE_WHITELISTS = {
  [COLLECTIONS.inspirations]: ['title', 'desc', 'meta', 'linkedMaterialId', 'linkedMaterialTitle', 'linkedRehearsalId', 'linkedRehearsalTitle', 'sourceType', 'sourceId', 'sourceTitle'],
  [COLLECTIONS.methodCards]: ['type', 'title', 'desc', 'meta', 'sourceType', 'sourceId', 'sourceTitle'],
  [COLLECTIONS.rehearsals]: ['title', 'desc', 'teamName', 'duration', 'goals', 'source', 'status', 'plan', 'reviewKeep', 'reviewTry', 'reviewReminder', 'meta'],
  [COLLECTIONS.practiceRecords]: ['materialId', 'materialTitle', 'rehearsalId', 'rehearsalTitle', 'title', 'desc', 'effect', 'keep', 'try', 'reminder', 'duration', 'meta']
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

function findUnknownFields(payload, whitelist) {
  return Object.keys(payload || {}).filter(key => !whitelist.includes(key))
}

function validateFields(payload, whitelist, requestId) {
  const unknown = findUnknownFields(payload, whitelist)
  if (unknown.length) return fail(`包含未定义字段: ${unknown.join(', ')}`, requestId, 400)
  return null
}

function validateOwnedPayload(collectionName, payload, requestId, isUpdate = false) {
  const whitelist = isUpdate ? UPDATE_WHITELISTS[collectionName] : FIELD_WHITELISTS[collectionName]
  const invalid = validateFields(payload, whitelist, requestId)
  if (invalid) return invalid
  if (!isUpdate && (!payload.id || typeof payload.id !== 'string')) return fail('缺少合法 id', requestId, 400)
  if (!isUpdate && (!payload.title || typeof payload.title !== 'string')) return fail('缺少合法 title', requestId, 400)
  if (!isUpdate && collectionName === COLLECTIONS.practiceRecords && (!payload.materialId || typeof payload.materialId !== 'string')) {
    return fail('缺少合法 materialId', requestId, 400)
  }
  return null
}

async function createFeedback(payload, requestId) {
  const whitelist = ['category', 'content', 'contact', 'sourcePage', 'appVersion']
  const invalid = validateFields(payload, whitelist, requestId)
  if (invalid) return invalid

  const categories = ['bug', 'suggestion', 'content', 'other']
  const category = typeof payload.category === 'string' ? payload.category.trim() : ''
  const content = typeof payload.content === 'string' ? payload.content.trim() : ''
  const contact = typeof payload.contact === 'string' ? payload.contact.trim() : ''
  const sourcePage = typeof payload.sourcePage === 'string' ? payload.sourcePage.trim() : ''
  const appVersion = typeof payload.appVersion === 'string' ? payload.appVersion.trim() : ''

  if (!categories.includes(category)) return fail('请选择反馈类型', requestId, 400)
  if (content.length < 10 || content.length > 500) return fail('反馈内容需为 10–500 字', requestId, 400)
  if (contact.length > 100) return fail('联系方式不能超过 100 字', requestId, 400)
  if (sourcePage.length > 200) return fail('来源页面过长', requestId, 400)
  if (appVersion.length > 40) return fail('版本信息过长', requestId, 400)

  const feedback = {
    id: `feedback-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    category,
    content,
    contact,
    sourcePage,
    appVersion,
    status: 'new',
    ownerOpenId: getOpenId(),
    createdAt: now(),
    updatedAt: now(),
    deletedAt: null
  }
  const result = await db.collection(COLLECTIONS.feedback).add({ data: feedback })
  return ok({ item: { id: feedback.id, _id: result._id } }, requestId)
}

async function getAllByWhere(collectionName, where, orderField, maxItems = MAX_MATERIAL_SCAN) {
  const items = []
  for (let offset = 0; offset < maxItems; offset += MAX_LIMIT) {
    const result = await db.collection(collectionName)
      .where(where)
      .orderBy(orderField, 'asc')
      .skip(offset)
      .limit(Math.min(MAX_LIMIT, maxItems - offset))
      .get()
    items.push(...result.data)
    if (result.data.length < MAX_LIMIT) break
  }
  return items
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
  const invalid = validateFields(payload, ['query', 'type', 'ability', 'scene', 'status', 'limit', 'offset'], requestId)
  if (invalid) return invalid
  const ownerOpenId = getOpenId()
  const limit = Math.min(Number(payload.limit) || DEFAULT_LIMIT, MAX_LIMIT)
  const offset = Math.max(Number(payload.offset) || 0, 0)
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
  const materials = await getAllByWhere(COLLECTIONS.materials, materialWhere, 'sortOrder')

  // 无 OPENID 时（如云控制台测试）跳过用户状态合并
  const statesResult = ownerOpenId
    ? { data: await getAllByWhere(COLLECTIONS.userMaterialStates, { ownerOpenId }, 'createdAt') }
    : { data: [] }

  const states = statesResult.data.reduce((map, item) => {
    map[item.materialId] = item
    return map
  }, {})
  const filteredItems = materials.map((material) => {
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
  const items = filteredItems.slice(offset, offset + limit)
  const nextOffset = offset + items.length
  return ok({
    items,
    total: filteredItems.length,
    hasMore: nextOffset < filteredItems.length,
    nextOffset: nextOffset < filteredItems.length ? nextOffset : null
  }, requestId)
}

async function createMaterial(payload, requestId) {
  const invalid = validateFields(payload, ['id', 'title', 'desc', 'type', 'tags', 'abilities', 'scenes', 'meta', 'steps', 'tips', 'variant', 'issue', 'relatedMaterialId', 'referenceOnly', 'stripeTone', 'sortOrder'], requestId)
  if (invalid) return invalid
  if (!payload.title) return fail('缺少素材名称', requestId, 400)
  const ownerOpenId = getOpenId()
  const existing = await db.collection(COLLECTIONS.materials).where({ id: payload.id, ownerOpenId, deletedAt: null }).limit(1).get()
  if (existing.data.length) return ok({ item: existing.data[0] }, requestId)
  const doc = normalizeMaterialPayload(payload, ownerOpenId)
  const result = await db.collection(COLLECTIONS.materials).add({ data: doc })
  return ok({ item: Object.assign({ _id: result._id }, doc) }, requestId)
}

async function updateMaterial(payload, requestId) {
  const invalid = validateFields(payload, ['id', 'title', 'desc', 'type', 'tags', 'abilities', 'scenes', 'meta', 'steps', 'tips', 'variant', 'issue', 'relatedMaterialId', 'referenceOnly', 'stripeTone', 'sortOrder'], requestId)
  if (invalid) return invalid
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
  return ok({ item: Object.assign({}, existing.data[0], doc, { id: payload.id }) }, requestId)
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
  const invalid = validateFields(payload, ['materialId', 'saved', 'played', 'lastRehearsalAt'], requestId)
  if (invalid) return invalid
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
  const invalid = validateOwnedPayload(collectionName, payload, requestId)
  if (invalid) return invalid
  const safeData = pickFields(payload, whitelist)
  const collection = db.collection(collectionName)
  const existing = await collection.where(ownerWhere({ id: safeData.id })).limit(1).get()
  if (existing.data.length) return ok({ item: existing.data[0] }, requestId)
  const doc = Object.assign({}, safeData, {
    ownerOpenId: getOpenId(),
    createdAt: now(),
    updatedAt: now(),
    deletedAt: null
  })
  const result = await collection.add({ data: doc })
  return ok({ item: Object.assign({ _id: result._id }, doc) }, requestId)
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
  const invalid = validateOwnedPayload(collectionName, rawPatch, requestId, true)
  if (invalid) return invalid
  if (!Object.keys(rawPatch).length) return fail('没有可更新字段', requestId, 400)
  const safePatch = pickFields(rawPatch, whitelist)
  const patch = Object.assign({}, safePatch, { updatedAt: now() })
  await collection.doc(result.data[0]._id).update({ data: patch })
  return ok({ item: Object.assign({}, result.data[0], safePatch) }, requestId)
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
  return ok({ item: Object.assign({}, rehearsal, { plan, status: payload.rehearsalStatus || rehearsal.status || '进行中' }) }, requestId)
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

async function completePractice(payload, requestId) {
  const rootInvalid = validateFields(payload, ['practiceRecord', 'rehearsalPatch', 'methodCard'], requestId)
  if (rootInvalid) return rootInvalid
  const recordPayload = payload.practiceRecord || {}
  const recordInvalid = validateOwnedPayload(COLLECTIONS.practiceRecords, recordPayload, requestId)
  if (recordInvalid) return recordInvalid
  const rehearsalPatch = payload.rehearsalPatch || null
  const methodCardPayload = payload.methodCard || null
  if (rehearsalPatch) {
    const invalid = validateFields(rehearsalPatch, ['rehearsalId', 'materialId', 'status', 'keep', 'try'], requestId)
    if (invalid) return invalid
  }
  if (methodCardPayload) {
    const invalid = validateOwnedPayload(COLLECTIONS.methodCards, methodCardPayload, requestId)
    if (invalid) return invalid
  }

  const ownerOpenId = getOpenId()
  const result = await db.runTransaction(async transaction => {
    const practiceCollection = transaction.collection(COLLECTIONS.practiceRecords)
    const existingRecord = await practiceCollection.where({ ownerOpenId, id: recordPayload.id, deletedAt: null }).limit(1).get()
    let practiceRecord = existingRecord.data[0]
    if (practiceRecord) {
      let existingRehearsal = null
      let existingMethodCard = null
      if (rehearsalPatch) {
        const foundRehearsal = await transaction.collection(COLLECTIONS.rehearsals)
          .where({ ownerOpenId, id: rehearsalPatch.rehearsalId, deletedAt: null }).limit(1).get()
        existingRehearsal = foundRehearsal.data[0] || null
      }
      if (methodCardPayload) {
        const foundMethod = await transaction.collection(COLLECTIONS.methodCards)
          .where({ ownerOpenId, id: methodCardPayload.id, deletedAt: null }).limit(1).get()
        existingMethodCard = foundMethod.data[0] || null
      }
      return { practiceRecord, rehearsal: existingRehearsal, methodCard: existingMethodCard }
    }
    if (!practiceRecord) {
      practiceRecord = Object.assign({}, pickFields(recordPayload, FIELD_WHITELISTS[COLLECTIONS.practiceRecords]), {
        ownerOpenId,
        createdAt: now(),
        updatedAt: now(),
        deletedAt: null
      })
      const added = await practiceCollection.add({ data: practiceRecord })
      practiceRecord = Object.assign({ _id: added._id }, practiceRecord)
    }

    let rehearsal = null
    if (rehearsalPatch) {
      const rehearsalCollection = transaction.collection(COLLECTIONS.rehearsals)
      const rehearsalResult = await rehearsalCollection.where({ ownerOpenId, id: rehearsalPatch.rehearsalId, deletedAt: null }).limit(1).get()
      if (!rehearsalResult.data.length) throw new Error('关联排练不存在')
      rehearsal = rehearsalResult.data[0]
      const currentPlan = Array.isArray(rehearsal.plan) ? rehearsal.plan : []
      const plan = currentPlan.map(item => item.materialId === rehearsalPatch.materialId
        ? Object.assign({}, item, {
            status: rehearsalPatch.status || item.status,
            keep: typeof rehearsalPatch.keep === 'string' ? rehearsalPatch.keep : item.keep || '',
            try: typeof rehearsalPatch.try === 'string' ? rehearsalPatch.try : item.try || ''
          })
        : item)
      await rehearsalCollection.doc(rehearsal._id).update({ data: { plan, updatedAt: now() } })
      rehearsal = Object.assign({}, rehearsal, { plan })
    }

    let methodCard = null
    if (methodCardPayload) {
      const methodCollection = transaction.collection(COLLECTIONS.methodCards)
      const existingMethod = await methodCollection.where({ ownerOpenId, id: methodCardPayload.id, deletedAt: null }).limit(1).get()
      methodCard = existingMethod.data[0]
      if (!methodCard) {
        methodCard = Object.assign({}, pickFields(methodCardPayload, FIELD_WHITELISTS[COLLECTIONS.methodCards]), {
          ownerOpenId,
          createdAt: now(),
          updatedAt: now(),
          deletedAt: null
        })
        const added = await methodCollection.add({ data: methodCard })
        methodCard = Object.assign({ _id: added._id }, methodCard)
      }
    }

    const materialStateCollection = transaction.collection(COLLECTIONS.userMaterialStates)
    const materialStateResult = await materialStateCollection.where({ ownerOpenId, materialId: recordPayload.materialId }).limit(1).get()
    if (materialStateResult.data.length) {
      await materialStateCollection.doc(materialStateResult.data[0]._id).update({
        data: { playedCount: _.inc(1), lastPlayedAt: now(), updatedAt: now() }
      })
    } else {
      await materialStateCollection.add({ data: {
        ownerOpenId,
        materialId: recordPayload.materialId,
        saved: false,
        playedCount: 1,
        lastPlayedAt: now(),
        lastRehearsalAt: null,
        createdAt: now(),
        updatedAt: now()
      } })
    }
    return { practiceRecord, rehearsal, methodCard }
  })
  return ok(result, requestId)
}

async function completeRehearsal(payload, requestId) {
  const rootInvalid = validateFields(payload, ['id', 'patch', 'methodCard'], requestId)
  if (rootInvalid) return rootInvalid
  if (!payload.id) return fail('缺少排练 id', requestId, 400)
  const patch = payload.patch || {}
  const invalidPatch = validateOwnedPayload(COLLECTIONS.rehearsals, patch, requestId, true)
  if (invalidPatch) return invalidPatch
  const methodCardPayload = payload.methodCard || null
  if (methodCardPayload) {
    const invalid = validateOwnedPayload(COLLECTIONS.methodCards, methodCardPayload, requestId)
    if (invalid) return invalid
  }
  const ownerOpenId = getOpenId()
  const result = await db.runTransaction(async transaction => {
    const rehearsalCollection = transaction.collection(COLLECTIONS.rehearsals)
    const found = await rehearsalCollection.where({ ownerOpenId, id: payload.id, deletedAt: null }).limit(1).get()
    if (!found.data.length) throw new Error('排练记录不存在')
    const rehearsalPatch = Object.assign({}, pickFields(patch, UPDATE_WHITELISTS[COLLECTIONS.rehearsals]), {
      status: '已完成',
      updatedAt: now()
    })
    await rehearsalCollection.doc(found.data[0]._id).update({ data: rehearsalPatch })
    const rehearsal = Object.assign({}, found.data[0], rehearsalPatch)
    let methodCard = null
    if (methodCardPayload) {
      const methodCollection = transaction.collection(COLLECTIONS.methodCards)
      const existing = await methodCollection.where({ ownerOpenId, id: methodCardPayload.id, deletedAt: null }).limit(1).get()
      methodCard = existing.data[0]
      if (!methodCard) {
        methodCard = Object.assign({}, pickFields(methodCardPayload, FIELD_WHITELISTS[COLLECTIONS.methodCards]), {
          ownerOpenId,
          createdAt: now(),
          updatedAt: now(),
          deletedAt: null
        })
        const added = await methodCollection.add({ data: methodCard })
        methodCard = Object.assign({ _id: added._id }, methodCard)
      }
    }
    return { rehearsal, methodCard }
  })
  return ok(result, requestId)
}

async function deleteAccount(requestId) {
  const ownerOpenId = getOpenId()
  const profileResult = await db.collection(COLLECTIONS.profiles).where({ ownerOpenId, deletedAt: null }).limit(1).get()
  const avatarUrl = profileResult.data[0] && profileResult.data[0].avatarUrl
  const privateCollections = [
    COLLECTIONS.profiles,
    COLLECTIONS.inspirations,
    COLLECTIONS.rehearsals,
    COLLECTIONS.practiceRecords,
    COLLECTIONS.methodCards,
    COLLECTIONS.feedback,
    COLLECTIONS.materials
  ]
  await Promise.all(privateCollections.map(collectionName => db.collection(collectionName)
    .where({ ownerOpenId, deletedAt: null })
    .update({ data: { deletedAt: now(), updatedAt: now() } })))
  await db.collection(COLLECTIONS.userMaterialStates).where({ ownerOpenId }).remove()
  if (typeof avatarUrl === 'string' && avatarUrl.startsWith('cloud://')) {
    try {
      await cloud.deleteFile({ fileList: [avatarUrl] })
    } catch (error) {
      console.warn('[improv-api] delete avatar failed', error)
    }
  }
  return ok({ deleted: true }, requestId)
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
  'practiceRecord.delete': (payload, requestId) => deleteOwned(COLLECTIONS.practiceRecords, payload, requestId),
  'practice.complete': (payload, requestId) => completePractice(payload, requestId),
  'rehearsal.complete': (payload, requestId) => completeRehearsal(payload, requestId),
  'feedback.create': (payload, requestId) => createFeedback(payload, requestId),
  'account.delete': (_payload, requestId) => deleteAccount(requestId)
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
