const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

const COLLECTIONS = {
  games: 'improv_games',
  userGameStates: 'improv_user_game_states',
  profiles: 'improv_profiles',
  inspirations: 'improv_inspirations',
  rehearsals: 'improv_rehearsals',
  gameRecords: 'improv_game_records',
  methodCards: 'improv_method_cards'
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

function normalizeGamePayload(payload, ownerOpenId) {
  return {
    id: payload.id || `custom-${Date.now()}`,
    title: payload.title,
    desc: payload.desc || '',
    tags: Array.isArray(payload.tags) ? payload.tags : ['自定义'],
    meta: Array.isArray(payload.meta) ? payload.meta : [],
    steps: Array.isArray(payload.steps) ? payload.steps : [],
    tips: payload.tips || '',
    variant: payload.variant || '',
    issue: payload.issue || '',
    relatedGameId: payload.relatedGameId || '',
    stripeTone: payload.stripeTone || 'orange',
    sortOrder: Number(payload.sortOrder) || 999,
    ownerOpenId,
    createdAt: now(),
    updatedAt: now(),
    deletedAt: null
  }
}

async function seedGames(requestId) {
  return fail('已移除代码内 seed 数据，请改为手动导入仓库根目录 mock_data/improv_games.json', requestId, 400)
}

async function listGames(payload, requestId) {
  const ownerOpenId = getOpenId()
  const limit = Math.min(Number(payload.limit) || 50, 100)
  const gamesResult = await db.collection(COLLECTIONS.games)
    .where({ deletedAt: null })
    .orderBy('sortOrder', 'asc')
    .limit(limit)
    .get()
  const statesResult = await db.collection(COLLECTIONS.userGameStates)
    .where({ ownerOpenId })
    .limit(100)
    .get()
  const states = statesResult.data.reduce((map, item) => {
    map[item.gameId] = item
    return map
  }, {})
  const items = gamesResult.data.map((game) => {
    const state = states[game.id] || {}
    return Object.assign({}, game, {
      saved: !!state.saved,
      played: !!state.playedCount,
      playedCount: state.playedCount || 0,
      lastPlayedAt: state.lastPlayedAt || null,
      lastRehearsalAt: state.lastRehearsalAt || null
    })
  })
  return ok({ items }, requestId)
}

async function createGame(payload, requestId) {
  if (!payload.title) return fail('缺少游戏名称', requestId, 400)
  const ownerOpenId = getOpenId()
  const doc = normalizeGamePayload(payload, ownerOpenId)
  const result = await db.collection(COLLECTIONS.games).add({ data: doc })
  return ok({ id: result._id, gameId: doc.id }, requestId)
}

async function updateGame(payload, requestId) {
  if (!payload.id) return fail('缺少游戏 ID', requestId, 400)
  if (!payload.title) return fail('缺少游戏名称', requestId, 400)
  const ownerOpenId = getOpenId()
  
  const collection = db.collection(COLLECTIONS.games)
  const existing = await collection.where({ id: payload.id, ownerOpenId, deletedAt: null }).limit(1).get()
  if (!existing.data.length) return fail('游戏不存在或无权限修改', requestId, 404)
  
  const doc = normalizeGamePayload(payload, ownerOpenId)
  // 保持原有 ID 和创建时间
  delete doc.id
  doc.updatedAt = now()
  
  await collection.doc(existing.data[0]._id).update({
    data: Object.assign({}, doc, {
      fit: _.remove(),
      lead: _.remove(),
      avoid: _.remove(),
      verdict: _.remove()
    })
  })
  return ok({ gameId: payload.id }, requestId)
}

async function deleteGame(payload, requestId) {
  if (!payload.id) return fail('缺少游戏 ID', requestId, 400)
  const ownerOpenId = getOpenId()
  
  const collection = db.collection(COLLECTIONS.games)
  const existing = await collection.where({ id: payload.id, ownerOpenId, deletedAt: null }).limit(1).get()
  if (!existing.data.length) return fail('游戏不存在或无权限删除', requestId, 404)
  
  await collection.doc(existing.data[0]._id).update({ data: { deletedAt: now() } })
  return ok({ gameId: payload.id }, requestId)
}

async function updateGameState(payload, requestId) {
  const ownerOpenId = getOpenId()
  if (!payload.gameId) return fail('缺少 gameId', requestId, 400)
  const collection = db.collection(COLLECTIONS.userGameStates)
  const existing = await collection.where({ ownerOpenId, gameId: payload.gameId }).limit(1).get()
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
    return ok({ gameId: payload.gameId }, requestId)
  }

  await collection.add({
    data: Object.assign({
      ownerOpenId,
      gameId: payload.gameId,
      saved: !!payload.saved,
      playedCount: payload.played ? 1 : 0,
      lastPlayedAt: payload.played ? now() : null,
      lastRehearsalAt: payload.lastRehearsalAt ? now() : null,
      createdAt: now()
    }, patch)
  })
  return ok({ gameId: payload.gameId }, requestId)
}

async function listOwned(collectionName, payload, requestId) {
  const limit = Math.min(Number(payload.limit) || 50, 100)
  const result = await db.collection(collectionName)
    .where(ownerWhere())
    .orderBy('updatedAt', 'desc')
    .limit(limit)
    .get()
  return ok({ items: result.data }, requestId)
}

async function createOwned(collectionName, payload, requestId) {
  const result = await db.collection(collectionName).add({
    data: Object.assign({}, payload, {
      ownerOpenId: getOpenId(),
      createdAt: now(),
      updatedAt: now(),
      deletedAt: null
    })
  })
  return ok({ id: result._id }, requestId)
}

async function updateOwned(collectionName, payload, requestId) {
  if (!payload.id) return fail('缺少 id', requestId, 400)
  const collection = db.collection(collectionName)
  const result = await collection.where(ownerWhere({ id: payload.id })).limit(1).get()
  if (!result.data.length) return fail('未找到记录', requestId, 404)
  const patch = Object.assign({}, payload.patch || {}, { updatedAt: now() })
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

async function updateRehearsalGameStatus(payload, requestId) {
  if (!payload.rehearsalId || !payload.gameId) return fail('缺少 rehearsalId 或 gameId', requestId, 400)
  const collection = db.collection(COLLECTIONS.rehearsals)
  const result = await collection.where(ownerWhere({ id: payload.rehearsalId })).limit(1).get()
  if (!result.data.length) return fail('未找到排练记录', requestId, 404)
  const rehearsal = result.data[0]
  const currentPlan = Array.isArray(rehearsal.plan) ? rehearsal.plan : []
  const plan = currentPlan.map((item) => item.gameId === payload.gameId
    ? Object.assign({}, item, {
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
  return ok({ rehearsalId: payload.rehearsalId, gameId: payload.gameId }, requestId)
}

async function todaySummary(requestId) {
  const ownerOpenId = getOpenId()
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const [inspirations, rehearsals] = await Promise.all([
    db.collection(COLLECTIONS.inspirations).where({
      ownerOpenId,
      deletedAt: null,
      createdAt: _.gte(start)
    }).orderBy('createdAt', 'desc').limit(20).get(),
    db.collection(COLLECTIONS.rehearsals).where({
      ownerOpenId,
      deletedAt: null,
      createdAt: _.gte(start)
    }).orderBy('createdAt', 'desc').limit(20).get()
  ])
  return ok({
    inspirations: inspirations.data,
    rehearsals: rehearsals.data,
    recommendGameId: 'status-swap'
  }, requestId)
}

exports.main = async (event) => {
  const action = event.action
  const payload = event.payload || {}
  const requestId = event.requestId || ''

  try {
    if (action === 'game.seed' || action === 'seed.games') return seedGames(requestId)
    if (action === 'game.list') return listGames(payload, requestId)
    if (action === 'game.create') return createGame(payload, requestId)
    if (action === 'game.update') return updateGame(payload, requestId)
    if (action === 'game.delete') return deleteGame(payload, requestId)
    if (action === 'game.updateState' || action === 'game.updateSaved' || action === 'game.updatePlayed') return updateGameState(payload, requestId)
    if (action === 'profile.get') return getProfile(requestId)
    if (action === 'profile.update') return updateProfile(payload, requestId)
    if (action === 'today.summary') return todaySummary(requestId)
    if (action === 'inspiration.list') return listOwned(COLLECTIONS.inspirations, payload, requestId)
    if (action === 'inspiration.create') return createOwned(COLLECTIONS.inspirations, payload, requestId)
    if (action === 'methodCard.list') return listOwned(COLLECTIONS.methodCards, payload, requestId)
    if (action === 'methodCard.create') return createOwned(COLLECTIONS.methodCards, payload, requestId)
    if (action === 'rehearsal.list') return listOwned(COLLECTIONS.rehearsals, payload, requestId)
    if (action === 'rehearsal.create') return createOwned(COLLECTIONS.rehearsals, payload, requestId)
    if (action === 'rehearsal.update') return updateOwned(COLLECTIONS.rehearsals, payload, requestId)
    if (action === 'rehearsal.updateGameStatus') return updateRehearsalGameStatus(payload, requestId)
    if (action === 'gameRecord.list') return listOwned(COLLECTIONS.gameRecords, payload, requestId)
    if (action === 'gameRecord.create') return createOwned(COLLECTIONS.gameRecords, payload, requestId)
    return fail(`未知 action: ${action}`, requestId, 404)
  } catch (error) {
    console.error('[improv-api:error]', action, error)
    return fail('服务暂不可用，请稍后再试', requestId)
  }
}
