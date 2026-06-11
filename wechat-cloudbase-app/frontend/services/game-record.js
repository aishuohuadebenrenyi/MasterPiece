const { callImprovAction } = require('./cloud')

function normalizeGameRecord(raw = {}) {
  return Object.assign({
    id: raw._id || `gameRecord-${Date.now()}`,
    gameId: '',
    rehearsalId: '',
    title: '',
    desc: '',
    effect: '',
    keep: '',
    try: '',
    reminder: '',
    duration: 0,
    meta: [],
    createdAt: Date.now()
  }, raw)
}

async function listGameRecords(filters = {}) {
  const response = await callImprovAction('gameRecord.list', filters)
  if (response.code === 0 && response.data && response.data.items) return response.data.items.map(normalizeGameRecord)
  throw new Error(response.message || '加载游戏记录失败')
}

async function createGameRecord(payload) {
  return callImprovAction('gameRecord.create', payload)
}

module.exports = {
  normalizeGameRecord,
  listGameRecords,
  createGameRecord
}
