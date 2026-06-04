const { callImprovAction } = require('./cloud')

async function listGameRecords(filters = {}) {
  const response = await callImprovAction('gameRecord.list', filters)
  if (response.code === 0 && response.data && response.data.items) return response.data.items
  return []
}

async function createGameRecord(payload) {
  return callImprovAction('gameRecord.create', payload)
}

module.exports = {
  listGameRecords,
  createGameRecord
}
