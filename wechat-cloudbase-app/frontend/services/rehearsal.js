const { GAME_STATUS } = require('../constants/enums')
const { callImprovAction } = require('./cloud')

function nextGameStatus(status) {
  const index = GAME_STATUS.indexOf(status)
  return GAME_STATUS[(index + 1) % GAME_STATUS.length]
}

async function listRehearsals(filters = {}) {
  const response = await callImprovAction('rehearsal.list', filters)
  if (response.code === 0 && response.data && response.data.items) return response.data.items
  return []
}

async function createRehearsal(payload) {
  return callImprovAction('rehearsal.create', payload)
}

async function updateGameStatus(payload) {
  return callImprovAction('rehearsal.updateGameStatus', payload)
}

module.exports = {
  nextGameStatus,
  listRehearsals,
  createRehearsal,
  updateGameStatus
}
