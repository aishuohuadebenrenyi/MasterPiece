const { callImprovAction } = require('./cloud')

async function listInspirations(filters = {}) {
  const response = await callImprovAction('inspiration.list', filters)
  if (response.code === 0 && response.data && response.data.items) return response.data.items
  return []
}

async function createInspiration(payload) {
  return callImprovAction('inspiration.create', payload)
}

module.exports = {
  listInspirations,
  createInspiration
}
