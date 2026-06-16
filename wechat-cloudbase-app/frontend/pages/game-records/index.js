const { listPracticeRecords } = require('../../services/practice-record')
const { getState , getThemeClass } = require('../../store/index')
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
    themeClass: 'theme-default',
    records: [],
    layoutStyle: '',
    loading: false,
    errorText: '',
    showSummaryCard: false,
    detailVisible: false,
    modalOpen: false,
    selectedRecord: null,
    selectedNotes: []
  },
  onLoad() {
    this.setData({
      themeClass: getThemeClass(),
      layoutStyle: getLayoutStyle()
    })
  },
  async onShow() {
    this.setData({ themeClass: getThemeClass() })
    const state = getState()
    this.setData({
      records: buildRecordViewModels(state.practiceRecordsHistory || []),
      layoutStyle: getLayoutStyle(),
      loading: true,
      errorText: '',
      showSummaryCard: false
    })
    try {
      const records = await listPracticeRecords()
      const normalizedRecords = buildRecordViewModels(records)
      this.setData({
        records: normalizedRecords,
        loading: false,
        errorText: '',
        showSummaryCard: normalizedRecords.length > 0
      })
    } catch (error) {
      const fallbackRecords = buildRecordViewModels(state.practiceRecordsHistory || [])
      this.setData({
        records: fallbackRecords,
        loading: false,
        errorText: '云端暂时不可用，当前只显示本次会话里的练习记录。',
        showSummaryCard: fallbackRecords.length > 0
      })
    }
  },
  back() {
    wx.navigateBack()
  },
  openRecord(event) {
    const id = event.detail && event.detail.id
      ? event.detail.id
      : event.currentTarget.dataset.id
    const selectedRecord = (this.data.records || []).find((item) => item.id === id)
    if (!selectedRecord) return
    const selectedNotes = []
    if (selectedRecord.keep) selectedNotes.push(`Keep：${selectedRecord.keep}`)
    if (selectedRecord.try) selectedNotes.push(`Try：${selectedRecord.try}`)
    if (selectedRecord.reminder) selectedNotes.push(`提醒：${selectedRecord.reminder}`)
    openModal(this, {
      detailVisible: true,
      selectedRecord,
      selectedNotes
    })
  },
  closeSheet() {
    closeModal(this, {
      detailVisible: false,
      selectedRecord: null,
      selectedNotes: []
    })
  },
  goDiscover() {
    wx.switchTab({ url: '/pages/discover/index' })
  },
  goRecord() {
    wx.switchTab({ url: '/pages/record/index' })
  }
})
