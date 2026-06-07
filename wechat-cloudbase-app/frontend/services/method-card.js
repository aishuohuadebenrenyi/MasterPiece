const { callImprovAction } = require('./cloud')

async function listMethodCards(filters = {}) {
  const response = await callImprovAction('methodCard.list', filters)
  if (response.code === 0 && response.data && response.data.items) return response.data.items
  return []
}

async function createMethodCard(payload) {
  return callImprovAction('methodCard.create', payload)
}

module.exports = {
  listMethodCards,
  createMethodCard
}
