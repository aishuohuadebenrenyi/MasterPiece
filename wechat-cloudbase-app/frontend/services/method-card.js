const { callImprovAction } = require('./cloud')

async function listMethodCards(filters = {}) {
  const response = await callImprovAction('methodCard.list', filters)
  if (response.code === 0 && response.data && response.data.items) return response.data.items
  throw new Error(response.message || '加载方法卡失败')
}

async function createMethodCard(payload) {
  return callImprovAction('methodCard.create', payload)
}

module.exports = {
  listMethodCards,
  createMethodCard
}
