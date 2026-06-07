const { listGameRecords } = require('../../services/game-record')
const { getState } = require('../../store/index')
const { getLayoutStyle } = require('../../utils/layout')
const { closeModal, openModal } = require('../../utils/modal')

function formatTime(timestamp) {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

function getDisplayDesc(record = {}) {
  const parts = []
  if (record.keep) parts.push(`Keep: ${record.keep}`)
  if (record.try) parts.push(`Try: ${record.try}`)
  if (record.reminder) parts.push(`提醒: ${record.reminder}`)
  if (parts.length) return parts.join(' | ')
  return record.desc || '无反馈内容'
}

function normalizeRecordForView(record = {}) {
  const meta = record.meta || []
  let displayMeta = [...meta]
  if (record.duration > 0) {
    displayMeta.unshift(`${Math.floor(record.duration / 60)} 分钟`)
  }

  return Object.assign({}, record, {
    dateLabel: formatTime(record.createdAt),
    displayDesc: getDisplayDesc(record),
    displayMeta
  })
}

function buildRecordViewModels(records = []) {
  const byId = records.reduce((items, item) => {
    if (!items.some((entry) => entry.id === item.id)) items.push(item)
    return items
  }, [])
  return byId.map(normalizeRecordForView)
}

Page({
  data: {
    records: [],
    layoutStyle: '',
    loading: false,
    errorText: '',
    detailVisible: false,
    modalOpen: false,
    selectedRecord: null
  },
  async onShow() {
    const state = getState()
    this.setData({
      records: buildRecordViewModels(state.gameRecordsHistory || []),
      layoutStyle: getLayoutStyle(),
      loading: true,
      errorText: ''
    })
    try {
      const records = await listGameRecords()
      this.setData({
        records: buildRecordViewModels(records),
        loading: false,
        errorText: ''
      })
    } catch (error) {
      this.setData({
        records: buildRecordViewModels(state.gameRecordsHistory || []),
        loading: false,
        errorText: '云端暂时不可用，已显示本地记录。'
      })
    }
  },
  back() {
    wx.navigateBack()
  },
  openRecord(event) {
    const id = event.currentTarget.dataset.id
    const selectedRecord = (this.data.records || []).find((item) => item.id === id)
    if (!selectedRecord) return
    openModal(this, {
      detailVisible: true,
      selectedRecord
    })
  },
  closeSheet() {
    closeModal(this, {
      detailVisible: false,
      selectedRecord: null
    })
  }
})