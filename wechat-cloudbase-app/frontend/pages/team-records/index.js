const { listRehearsals, deleteRehearsal } = require('../../services/rehearsal')
const { getState , getThemeClass } = require('../../store/index')
const { getLayoutStyle } = require('../../utils/layout')
const { closeModal, openModal } = require('../../utils/modal')
const { buildRehearsalRecordCardViewModel, formatDateLabel } = require('../../utils/record-card')
const { DEFAULT_PAGE_LIMIT } = require('../../config/constants')

function normalizePlan(plan = []) {
  const games = getState().materials || []
  const gameTitleMap = games.reduce((map, game) => {
    map[game.id] = game.title
    return map
  }, {})
  return plan.map((item, index) => ({
    ...item,
    title: gameTitleMap[item.materialId] || item.materialId || `素材 ${index + 1}`,
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

function normalizeRecordForView(record = {}) {
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
    dateLabel: record.dateLabel || formatDateLabel(record.createdAt),
    displayTitle: getDisplayTitle(record),
    displayDesc: getDisplayDesc(record),
    displayMeta,
    statusLabel: review || (record.status === '已完成' ? '已完成' : record.status || ''),
    plan,
    cardView: buildRehearsalRecordCardViewModel({
      ...record,
      dateLabel: record.dateLabel || formatDateLabel(record.createdAt),
      displayTitle: getDisplayTitle(record),
      displayDesc: getDisplayDesc(record),
      displayMeta
    })
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
    selectedDetailMeta: [],
    hasMore: true,
    pageLoading: false
  },

  onShareAppMessage() {
    return {
      title: '即兴工具箱 — 找素材·快记录·可沉淀',
      path: '/pages/discover/index',
      imageUrl: '/assets/share/share-brand.png'
    }
  },

  currentLimit: DEFAULT_PAGE_LIMIT,
  async loadRecords(loadMore = false) {
    if (loadMore) {
      if (!this.data.hasMore || this.data.pageLoading) return
      this.currentLimit += DEFAULT_PAGE_LIMIT
      this.setData({ pageLoading: true })
    } else {
      this.currentLimit = DEFAULT_PAGE_LIMIT
      this.setData({ themeClass: getThemeClass() })
      const state = getState()
      this.setData({
        records: buildRecordViewModels(state.rehearsalHistory || []),
        layoutStyle: getLayoutStyle(),
        loading: true,
        errorText: '',
        showSummaryCard: false,
        hasMore: true
      })
    }
    try {
      const records = await listRehearsals({ limit: this.currentLimit })
      const normalizedRecords = buildRecordViewModels(records)
      this.setData({
        records: normalizedRecords,
        loading: false,
        pageLoading: false,
        errorText: '',
        showSummaryCard: normalizedRecords.length > 0,
        hasMore: records.length >= this.currentLimit
      })
    } catch (error) {
      const state = getState()
      const fallbackRecords = buildRecordViewModels(state.rehearsalHistory || [])
      this.setData({
        records: fallbackRecords,
        loading: false,
        pageLoading: false,
        errorText: '云端暂时不可用，当前只显示本次会话里的排练记录。',
        showSummaryCard: fallbackRecords.length > 0
      })
    }
  },

  onLoad() {
    this.setData({
      themeClass: getThemeClass(),
      layoutStyle: getLayoutStyle()
    })
  },

  async onShow() {
    await this.loadRecords()
  },

  async onPullDownRefresh() {
    await this.loadRecords()
    wx.stopPullDownRefresh()
  },

  onReachBottom() {
    this.loadRecords(true)
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
  },

  async onDeleteRehearsal(e) {
    const id = (e.detail && e.detail.id) || e.currentTarget.dataset.id
    if (!id) return
    const confirmed = await new Promise((resolve) => {
      wx.showModal({
        title: '删除排练记录',
        content: '确定删除这条排练记录吗？删除后不可恢复。',
        confirmText: '删除',
        confirmColor: '#FF6A3D',
        success: (res) => resolve(res.confirm),
        fail: () => resolve(false)
      })
    })
    if (!confirmed) return
    try {
      const result = await deleteRehearsal(id)
      if (result.code === 0) {
        this.setData({
          records: this.data.records.filter(item => item.id !== id)
        })
        wx.showToast({ title: '已删除', icon: 'none' })
      } else {
        wx.showToast({ title: result.message || '删除失败', icon: 'none' })
      }
    } catch (err) {
      wx.showToast({ title: '删除失败', icon: 'none' })
    }
  }
})
