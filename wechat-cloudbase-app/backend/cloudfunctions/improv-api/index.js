const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

const COLLECTIONS = {
  games: 'improv_games',
  userGameStates: 'improv_user_game_states',
  inspirations: 'improv_inspirations',
  rehearsals: 'improv_rehearsals',
  gameRecords: 'improv_game_records',
  methodCards: 'improv_method_cards'
}

const SEED_GAMES = [
  {
    id: 'name-chain',
    title: '名字接龙变奏',
    desc: '低门槛开场，快速统一声音和注意力。',
    category: '热身',
    tags: ['热身', '破冰', '新手'],
    meta: ['6-12 人', '8 分钟', '低难度'],
    fit: ['新手友好', '开场', '中等能量'],
    lead: '适合刚开场时快速让大家进入同一个声音和注意力节奏。',
    steps: ['围成一圈，每个人说出自己的名字并配一个动作。', '下一位重复前面内容，再加入自己的名字和动作。', '逐渐加快节奏，让大家进入共同注意力。'],
    tips: '示范动作要轻松、可模仿，先让大家敢做，再追求节奏。',
    variant: '变体：加入情绪、拍手节奏或不同声音状态。',
    issue: '翻车点：动作过复杂会拖慢节奏，第一轮保持简单。',
    relatedGameId: 'status-swap',
    stripeTone: 'orange',
    sortOrder: 10
  },
  {
    id: 'status-swap',
    title: '一句话交换身份',
    desc: '用一句台词确认彼此身份，快速建立关系。',
    category: '关系',
    tags: ['关系', '叙事', '中等'],
    meta: ['2-6 人', '12 分钟', '关系练习'],
    fit: ['关系建立', '双人练习', '中等难度'],
    lead: '当你想快一点进入人物关系、又不想把规则讲得太重的时候，它很合适。',
    steps: ['一人抛出带身份关系的台词。', '另一人接住关系，并在下一句继续确认。', '几轮后复盘：哪一句让关系变清楚了？'],
    tips: '提醒参与者不要解释背景，先把“我和你是什么关系”演清楚。',
    variant: '变体：限定每句话只能新增一个关系信息。',
    issue: '翻车点：信息一次给太多，关系反而会糊。',
    relatedGameId: 'space-walk',
    stripeTone: 'blue',
    sortOrder: 20
  },
  {
    id: 'space-walk',
    title: '空间行走切换',
    desc: '现场有点散时，适合重新聚焦身体和节奏。',
    category: '专注',
    tags: ['专注', '热身', '身体'],
    meta: ['6-12 人', '10 分钟', '中等能量'],
    fit: ['身体到场', '注意力分散', '开场前'],
    lead: '如果你感觉大家的身体还没到场，它能比继续解释更快把人带回来。',
    steps: ['所有人在空间里自由行走，感受彼此距离。', '带领者给出速度、方向、状态切换口令。', '加入停顿、对视或成组，提高现场专注度。'],
    tips: '口令保持清晰，变化不要过多，让身体先跟上。',
    variant: '变体：加入情绪温度、重力、身体部位带路。',
    issue: '翻车点：口令过快会让大家只想做对，而不是感受现场。',
    relatedGameId: 'name-chain',
    stripeTone: 'mint',
    sortOrder: 30
  }
]

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
    category: payload.category || '自定义',
    tags: Array.isArray(payload.tags) ? payload.tags : ['自定义'],
    meta: Array.isArray(payload.meta) ? payload.meta : [],
    fit: Array.isArray(payload.fit) ? payload.fit : [],
    lead: payload.lead || payload.desc || '',
    steps: Array.isArray(payload.steps) ? payload.steps : [],
    tips: payload.tips || '',
    variant: payload.variant || '',
    issue: payload.issue || '',
    relatedGameId: payload.relatedGameId || 'name-chain',
    stripeTone: payload.stripeTone || 'orange',
    sortOrder: Number(payload.sortOrder) || 999,
    ownerOpenId,
    createdAt: now(),
    updatedAt: now(),
    deletedAt: null
  }
}

async function removeAll(collectionName) {
  const collection = db.collection(collectionName)
  let removed = 0
  while (true) {
    const result = await collection.limit(100).get()
    if (!result.data.length) break
    await Promise.all(result.data.map((doc) => collection.doc(doc._id).remove()))
    removed += result.data.length
    if (result.data.length < 100) break
  }
  return removed
}

async function seedGames(requestId) {
  const removed = await removeAll(COLLECTIONS.games)
  const collection = db.collection(COLLECTIONS.games)
  for (const game of SEED_GAMES) {
    await collection.add({
      data: Object.assign({}, game, {
        ownerOpenId: 'system',
        createdAt: now(),
        updatedAt: now(),
        deletedAt: null
      })
    })
  }
  return ok({ removed, inserted: SEED_GAMES.length, total: SEED_GAMES.length }, requestId)
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
    if (action === 'game.updateState' || action === 'game.updateSaved' || action === 'game.updatePlayed') return updateGameState(payload, requestId)
    if (action === 'today.summary') return todaySummary(requestId)
    if (action === 'inspiration.list') return listOwned(COLLECTIONS.inspirations, payload, requestId)
    if (action === 'inspiration.create') return createOwned(COLLECTIONS.inspirations, payload, requestId)
    if (action === 'methodCard.list') return listOwned(COLLECTIONS.methodCards, payload, requestId)
    if (action === 'methodCard.create') return createOwned(COLLECTIONS.methodCards, payload, requestId)
    if (action === 'rehearsal.list') return listOwned(COLLECTIONS.rehearsals, payload, requestId)
    if (action === 'rehearsal.create') return createOwned(COLLECTIONS.rehearsals, payload, requestId)
    if (action === 'gameRecord.list') return listOwned(COLLECTIONS.gameRecords, payload, requestId)
    if (action === 'gameRecord.create') return createOwned(COLLECTIONS.gameRecords, payload, requestId)
    return fail(`未知 action: ${action}`, requestId, 404)
  } catch (error) {
    console.error('[improv-api:error]', action, error)
    return fail('服务暂不可用，请稍后再试', requestId)
  }
}
