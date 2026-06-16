const { listRehearsals } = require('../../services/rehearsal')
const { getState , getThemeClass } = require('../../store/index')
const { getLayoutStyle } = require('../../utils/layout')
const { closeModal, openModal } = require('../../utils/modal')

function normalizePlan(plan = []) {
  const games = getState().materials || []
  const gameTitleMap = games.reduce((map, game) => {
    map[game.id] = game.title
    return map
  }, {})
  return plan.map((item, index) => ({
    ...item,
    title: gameTitleMap[item.materialId || item.gameId] || item.materialId || item.gameId || `素材 ${index + 1}`,
    status: item.status || '未开始',
    keep: item.keep || '',
    try: item.try || ''
  }))
}

function firstMetaByPattern(meta = [], pattern) {
  return meta.find((item) => pattern.test(item)) || ''
}

function getDisplayTitle(record = {}) {
  if (record.displayTitle) return record.displayTitle
  if (record.goals && record.goals.length) return record.goals.join(' + ')
  return String(record.title || '').trim() || '团队排练'
}

function getDisplayDesc(record = {}) {
  if (record.displayDesc) return record.displayDesc
  if (record.desc && /^完成：|^Try：|^Keep：/.test(record.desc)) return record.desc
  if (record.desc) return `完成：${String(record.desc).replace(/\s*→\s*/g, '、')}`
  return '按时间回看团队练习、素材反馈和下次提醒。'
}

function normalizeRecordForView(record = {}, index = 0) {
  const plan = normalizePlan(record.plan || [])
  const meta = record.meta || []
  const people = firstMetaByPattern(meta, /人$/)
  const review = firstMetaByPattern(meta, /复盘|提醒|沉淀|关系/)
  const displayMeta = [
    people,
    `${plan.length} 条素材`,
    review || (record.status === '已完成' ? '已完成' : record.status || '')
  ].filter(Boolean)

  return Object.assign({}, record, {
    dateLabel: record.dateLabel || '',
    displayTitle: getDisplayTitle(record),
    displayDesc: getDisplayDesc(record),
    displayMeta,
    statusLabel: review || (record.status === '已完成' ? '已完成' : record.status || ''),
    plan
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
    selectedPlan: [],
    selectedDetailMeta: []
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
      records: buildRecordViewModels(state.rehearsalHistory || []),
      layoutStyle: getLayoutStyle(),
      loading: true,
      errorText: '',
      showSummaryCard: false
    })
    try {
      const records = await listRehearsals()
      const normalizedRecords = buildRecordViewModels(records)
      this.setData({
        records: normalizedRecords,
        loading: false,
        errorText: '',
        showSummaryCard: normalizedRecords.length > 0
      })
    } catch (error) {
      const fallbackRecords = buildRecordViewModels(state.rehearsalHistory || [])
      this.setData({
        records: fallbackRecords,
        loading: false,
        errorText: '云端暂时不可用，当前只显示本次会话里的排练记录。',
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
    openModal(this, {
      detailVisible: true,
      selectedRecord,
      selectedPlan: selectedRecord.plan || [],
      selectedDetailMeta: [
        `${selectedRecord.duration} 分钟`,
        selectedRecord.statusLabel,
        `${(selectedRecord.plan || []).length} 条素材`
      ].filter(Boolean)
    })
  },
  closeSheet() {
    closeModal(this, {
      detailVisible: false,
      selectedRecord: null,
      selectedPlan: [],
      selectedDetailMeta: []
    })
  },
  goRecord() {
    wx.switchTab({ url: '/pages/record/index' })
  },
  goDiscover() {
    wx.switchTab({ url: '/pages/discover/index' })
  }
})
