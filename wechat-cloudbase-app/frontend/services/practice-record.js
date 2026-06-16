const { callImprovAction } = require('./cloud')

function normalizePracticeRecord(raw = {}) {
  return Object.assign({
    id: raw.id || raw._id || `practiceRecord-${Date.now()}`,
    materialId: raw.materialId || raw.gameId || '',
    rehearsalId: '',
    title: '',
    desc: '',
    effect: '',
    keep: '',
    try: '',
    reminder: '',
    duration: 0,
    meta: [],
    type: '素材练习',
    syncStatus: 'synced'
  }, raw, {
    materialId: raw.materialId || raw.gameId || ''
  })
}

async function listPracticeRecords(filters = {}) {
  const response = await callImprovAction('practiceRecord.list', filters, { silent: true })
  if (response.code === 0 && response.data && response.data.items) return response.data.items.map(normalizePracticeRecord)
  throw new Error(response.message || '加载练习记录失败')
}

async function createPracticeRecord(payload) {
  return callImprovAction('practiceRecord.create', payload)
}

module.exports = {
  normalizePracticeRecord,
  listPracticeRecords,
  createPracticeRecord
}
