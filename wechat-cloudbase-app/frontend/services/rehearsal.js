const { GAME_STATUS } = require('../constants/enums')
const { callImprovAction } = require('./cloud')

function normalizeRehearsal(raw = {}) {
  return Object.assign({
    id: raw._id || `rehearsal-${Date.now()}`,
    title: '',
    desc: '',
    teamName: '',
    duration: '90',
    goals: [],
    source: 'recommended',
    status: '进行中',
    plan: [],
    meta: []
  }, raw)
}

function nextMaterialStatus(status) {
  const index = GAME_STATUS.indexOf(status)
  return GAME_STATUS[(index + 1) % GAME_STATUS.length]
}

async function listRehearsals(filters = {}) {
  const response = await callImprovAction('rehearsal.list', filters)
  if (response.code === 0 && response.data && response.data.items) return response.data.items.map(normalizeRehearsal)
  throw new Error(response.message || '加载排练记录失败')
}

async function createRehearsal(payload) {
  return callImprovAction('rehearsal.create', payload)
}

async function updateRehearsal(id, patch) {
  return callImprovAction('rehearsal.update', { id, patch })
}

async function updateMaterialStatus(payload) {
  return callImprovAction('rehearsal.updateMaterialStatus', payload)
}

module.exports = {
  normalizeRehearsal,
  nextGameStatus: nextMaterialStatus,
  nextMaterialStatus,
  listRehearsals,
  createRehearsal,
  updateRehearsal,
  updateGameStatus: updateMaterialStatus,
  updateMaterialStatus
}
