const { listPracticeRecords, deletePracticeRecord } = require('../../services/practice-record')
const { getState , getThemeClass } = require('../../store/index')
const { getLayoutStyle } = require('../../utils/layout')
const { closeModal, openModal } = require('../../utils/modal')
const { buildPracticeRecordCardViewModel, formatDateLabel } = require('../../utils/record-card')
const { DEFAULT_PAGE_LIMIT } = require('../../config/constants')
const { toast } = require('../../utils/page')

function normalizeRecordForView(record = {}) {
  const displayMeta = []
  if (record.duration > 0) displayMeta.push(`${Math.floor(record.duration / 60)} 分钟`)
  displayMeta.push(...((record.meta || []).filter(Boolean)))
  return Object.assign({}, record, {
    dateLabel: formatDateLabel(record.createdAt),
    displayMeta,
    cardView: buildPracticeRecordCardViewModel(record)
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
    selectedNotes: [],
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
        records: buildRecordViewModels(state.practiceRecordsHistory || []),
        layoutStyle: getLayoutStyle(),
        loading: true,
        errorText: '',
        showSummaryCard: false,
        hasMore: true
      })
    }
    try {
      const records = await listPracticeRecords({ limit: this.currentLimit })
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
      const fallbackRecords = buildRecordViewModels(state.practiceRecordsHistory || [])
      this.setData({
        records: fallbackRecords,
        loading: false,
        pageLoading: false,
        errorText: '云端暂时不可用，当前只显示本次会话里的练习记录。',
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
  async onDeletePracticeRecord(e) {
    const id = (e.detail && e.detail.id) || e.currentTarget.dataset.id
    if (!id) return
    const confirmed = await new Promise((resolve) => {
      wx.showModal({
        title: '删除练习记录',
        content: '确定删除这条练习记录吗？删除后不可恢复。',
        confirmText: '删除',
        confirmColor: '#FF6A3D',
        success: (res) => resolve(res.confirm),
        fail: () => resolve(false)
      })
    })
    if (!confirmed) return
    try {
      await deletePracticeRecord(id)
      this.setData({
        records: this.data.records.filter(item => item.id !== id)
      })
      toast('已删除')
    } catch (err) {
      toast('删除失败')
    }
  },
  goDiscover() {
    wx.switchTab({ url: '/pages/discover/index' })
  },
  goRecord() {
    wx.switchTab({ url: '/pages/record/index' })
  }
})
