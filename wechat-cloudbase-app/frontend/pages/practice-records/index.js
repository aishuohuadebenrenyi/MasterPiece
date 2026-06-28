const { listPracticeRecords, deletePracticeRecord } = require('../../services/practice-record')
const { getState , getThemeClass } = require('../../store/index')
const { getLayoutStyle } = require('../../utils/layout')
const { closeModal, openModal } = require('../../utils/modal')
const { buildPracticeRecordCardViewModel, formatDateLabel } = require('../../utils/record-card')
const { DEFAULT_PAGE_LIMIT } = require('../../config/constants')
const { toast } = require('../../utils/page')

function buildFilterOptions(options = [], activeValue = 'all') {
  return options.map((item) => Object.assign({}, item, {
    activeClass: item.value === activeValue ? 'active' : ''
  }))
}

function buildMaterialStats(records = []) {
  return records.reduce((stats, record) => {
    const materialId = record.materialId
    if (!materialId) return stats
    const current = stats[materialId] || { count: 0, latestAt: 0 }
    const createdAt = Number(record.createdAt) || 0
    stats[materialId] = {
      count: current.count + 1,
      latestAt: Math.max(current.latestAt, createdAt),
      title: current.title || record.materialTitle || record.title || '未命名素材'
    }
    return stats
  }, {})
}

function buildMaterialFilterOptions(materials = [], records = []) {
  const stats = buildMaterialStats(records)
  const materialById = materials.reduce((items, item) => {
    if (item.id) items[item.id] = item
    return items
  }, {})
  return [
    { value: 'all', label: '全部素材', desc: '查看所有素材练习记录' }
  ].concat(Object.keys(stats).sort((a, b) => stats[b].latestAt - stats[a].latestAt).map((id) => {
    const stat = stats[id]
    const material = materialById[id] || {}
    return {
      value: id,
      label: material.title || stat.title,
      desc: `${stat.count} 条${stat.latestAt ? ' · 最近 ' + formatDateLabel(stat.latestAt) : ''}`
    }
  }))
}

function findOptionIndex(options = [], value = 'all') {
  const index = options.findIndex((item) => item.value === value)
  return index >= 0 ? index : 0
}

function findMaterialLabel(materials = [], materialId = 'all') {
  if (!materialId || materialId === 'all') return '全部素材'
  const material = materials.find((item) => item.id === materialId)
  return material ? material.title : '当前素材'
}

function filterRecords(records = [], filters = {}) {
  return records.filter((record) => {
    if (filters.materialId && filters.materialId !== 'all' && record.materialId !== filters.materialId) return false
    if (filters.minScore && Number(record.score) < Number(filters.minScore)) return false
    if (filters.maxScore && Number(record.score) > Number(filters.maxScore)) return false
    if (filters.attachmentType && filters.attachmentType !== 'all') {
      return Array.isArray(record.attachments) && record.attachments.some((item) => item.type === filters.attachmentType)
    }
    return true
  })
}

function filterMaterialOptions(options = [], keyword = '', activeValue = 'all') {
  const text = String(keyword || '').trim().toLowerCase()
  return options
    .filter((item) => {
      if (!text) return true
      return item.value === 'all' || String(item.label || '').toLowerCase().includes(text)
    })
    .map((item) => Object.assign({}, item, {
      activeClass: item.value === activeValue ? 'active' : ''
    }))
}

function normalizeRecordForView(record = {}) {
  const displayMeta = []
  if (record.score) displayMeta.push(`${record.score} 分`)
  if (record.duration > 0) displayMeta.push(`${Math.floor(record.duration / 60)} 分钟`)
  if (Array.isArray(record.attachments) && record.attachments.length) displayMeta.push(`${record.attachments.length} 个附件`)
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
    selectedAttachment: null,
    attachmentVisible: false,
    materialSheetVisible: false,
    materialSearchKeyword: '',
    filteredMaterialOptions: [],
    hasActiveFilter: false,
    filters: {
      materialId: 'all',
      minScore: '',
      maxScore: '',
      attachmentType: 'all'
    },
    materialOptions: [],
    selectedMaterialIndex: 0,
    materialFilterLabel: '全部素材',
    scoreOptions: buildFilterOptions([
      { value: 'all', label: '全部分数', minScore: '', maxScore: '' },
      { value: 'high', label: '8-10 分', minScore: 8, maxScore: 10 },
      { value: 'mid', label: '5-7 分', minScore: 5, maxScore: 7 },
      { value: 'low', label: '1-4 分', minScore: 1, maxScore: 4 }
    ]),
    attachmentOptions: buildFilterOptions([
      { value: 'all', label: '全部附件' },
      { value: 'image', label: '有照片' },
      { value: 'video', label: '有视频' }
    ]),
    hasMore: true,
    pageLoading: false,
    isRefreshing: false
  },

  onShareAppMessage() {
    return {
      title: '即兴工具箱 — 找素材·快记录·可沉淀',
      path: '/pages/discover/index',
      imageUrl: '/assets/share/share-brand.png'
    }
  },

  currentLimit: DEFAULT_PAGE_LIMIT,
  syncMaterialOptions(records = []) {
    const materials = getState().materials || []
    const materialOptions = buildMaterialFilterOptions(materials, records)
    const currentMaterialId = (this.data.filters && this.data.filters.materialId) || 'all'
    const selectedMaterialIndex = findOptionIndex(materialOptions, currentMaterialId)
    const selected = materialOptions[selectedMaterialIndex]
    const materialFilterLabel = selected
      ? selected.label
      : findMaterialLabel(materials, currentMaterialId)
    this.setData({
      materialOptions,
      selectedMaterialIndex,
      materialFilterLabel,
      filteredMaterialOptions: filterMaterialOptions(materialOptions, this.data.materialSearchKeyword, currentMaterialId),
      hasActiveFilter: currentMaterialId !== 'all'
        || !!this.data.filters.minScore
        || !!this.data.filters.maxScore
        || (this.data.filters.attachmentType && this.data.filters.attachmentType !== 'all')
    })
  },
  buildRequestFilters(limit = this.currentLimit) {
    const filters = this.data.filters || {}
    return {
      limit,
      materialId: filters.materialId,
      minScore: filters.minScore,
      maxScore: filters.maxScore,
      attachmentType: filters.attachmentType
    }
  },
  async loadRecords(loadMore = false) {
    if (loadMore) {
      if (!this.data.hasMore || this.data.pageLoading) return
      this.currentLimit += DEFAULT_PAGE_LIMIT
      this.setData({ pageLoading: true })
    } else {
      this.currentLimit = DEFAULT_PAGE_LIMIT
      this.setData({ themeClass: getThemeClass() })
      const state = getState()
      const localRecords = filterRecords(state.practiceRecordsHistory || [], this.data.filters)
      this.syncMaterialOptions(state.practiceRecordsHistory || [])
      this.setData({
        records: buildRecordViewModels(localRecords),
        layoutStyle: getLayoutStyle(),
        loading: true,
        errorText: '',
        showSummaryCard: false,
        hasMore: true
      })
    }
    try {
      const records = await listPracticeRecords(this.buildRequestFilters(this.currentLimit))
      const filteredRecords = filterRecords(records, this.data.filters)
      const normalizedRecords = buildRecordViewModels(filteredRecords)
      this.syncMaterialOptions(records)
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
      const fallbackRecords = buildRecordViewModels(filterRecords(state.practiceRecordsHistory || [], this.data.filters))
      this.setData({
        records: fallbackRecords,
        loading: false,
        pageLoading: false,
        errorText: '云端暂时不可用，当前只显示本次会话里的练习记录。',
        showSummaryCard: fallbackRecords.length > 0
      })
    }
  },

  onLoad(options = {}) {
    const materialId = options.materialId || 'all'
    const materials = getState().materials || []
    const materialOptions = buildMaterialFilterOptions(materials, getState().practiceRecordsHistory || [])
    const selectedMaterialIndex = findOptionIndex(materialOptions, materialId)
    const selected = materialOptions[selectedMaterialIndex]
    const materialFilterLabel = selected
      ? selected.label
      : findMaterialLabel(materials, materialId)
    this.setData({
      themeClass: getThemeClass(),
      layoutStyle: getLayoutStyle(),
      filters: Object.assign({}, this.data.filters, { materialId }),
      materialOptions,
      selectedMaterialIndex,
      materialFilterLabel,
      filteredMaterialOptions: filterMaterialOptions(materialOptions, '', materialId),
      hasActiveFilter: materialId !== 'all'
    })
  },

  async onShow() {
    await this.loadRecords()
  },

  async onPullDownRefresh() {
    await this.loadRecords()
    this.setData({ isRefreshing: false })
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
    if (selectedRecord.score) selectedNotes.push(`评分：${selectedRecord.score}/10`)
    if (selectedRecord.note) selectedNotes.push(`本次复盘：${selectedRecord.note}`)
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
  setMaterialFilter(e) {
    const optionIndex = Number(e.currentTarget.dataset.index)
    const materialId = e.currentTarget.dataset.materialId || e.currentTarget.dataset.value
    const optionFromList = Number.isInteger(optionIndex)
      ? (this.data.filteredMaterialOptions || [])[optionIndex]
      : null
    const option = optionFromList || (this.data.materialOptions || []).find((item) => item.value === materialId)
    if (!option || !option.value) return
    const selectedMaterialIndex = findOptionIndex(this.data.materialOptions, option.value)
    this.setData({
      filters: Object.assign({}, this.data.filters, { materialId: option.value }),
      selectedMaterialIndex,
      materialFilterLabel: option.label,
      materialSearchKeyword: '',
      filteredMaterialOptions: filterMaterialOptions(this.data.materialOptions, '', option.value),
      materialSheetVisible: false
    }, () => this.loadRecords())
  },
  openMaterialSheet() {
    openModal(this, {
      materialSheetVisible: true,
      filteredMaterialOptions: filterMaterialOptions(this.data.materialOptions, this.data.materialSearchKeyword, this.data.filters.materialId)
    })
  },
  closeMaterialSheet() {
    closeModal(this, {
      materialSheetVisible: false,
      materialSearchKeyword: ''
    })
  },
  updateMaterialSearch(e) {
    const materialSearchKeyword = e.detail.value || ''
    this.setData({
      materialSearchKeyword,
      filteredMaterialOptions: filterMaterialOptions(this.data.materialOptions, materialSearchKeyword, this.data.filters.materialId)
    })
  },
  clearMaterialSearch() {
    this.setData({
      materialSearchKeyword: '',
      filteredMaterialOptions: filterMaterialOptions(this.data.materialOptions, '', this.data.filters.materialId)
    })
  },
  setScoreFilter(e) {
    const value = e.currentTarget.dataset.value || 'all'
    const option = (this.data.scoreOptions || []).find((item) => item.value === value) || {}
    this.setData({
      filters: Object.assign({}, this.data.filters, {
        minScore: option.minScore || '',
        maxScore: option.maxScore || ''
      }),
      scoreOptions: buildFilterOptions(this.data.scoreOptions, value)
    }, () => this.loadRecords())
  },
  setAttachmentFilter(e) {
    const value = e.currentTarget.dataset.value || 'all'
    this.setData({
      filters: Object.assign({}, this.data.filters, { attachmentType: value }),
      attachmentOptions: buildFilterOptions(this.data.attachmentOptions, value)
    }, () => this.loadRecords())
  },
  handleEmptyPrimary() {
    if (this.data.hasActiveFilter) {
      this.setData({
        filters: Object.assign({}, this.data.filters, {
          materialId: 'all',
          minScore: '',
          maxScore: '',
          attachmentType: 'all'
        }),
        scoreOptions: buildFilterOptions(this.data.scoreOptions, 'all'),
        attachmentOptions: buildFilterOptions(this.data.attachmentOptions, 'all')
      }, () => this.loadRecords())
      return
    }
    this.goRecord()
  },
  openAttachment(e) {
    const id = e.currentTarget.dataset.id
    const attachments = (this.data.selectedRecord && this.data.selectedRecord.attachments) || []
    const selectedAttachment = attachments.find((item) => item.id === id)
    if (!selectedAttachment) return
    openModal(this, {
      attachmentVisible: true,
      selectedAttachment
    })
  },
  closeAttachment() {
    closeModal(this, {
      attachmentVisible: false,
      selectedAttachment: null
    })
  },
  async deleteAttachment() {
    const selectedRecord = this.data.selectedRecord
    const selectedAttachment = this.data.selectedAttachment
    if (!selectedRecord || !selectedAttachment) return
    const confirmed = await new Promise((resolve) => {
      wx.showModal({
        title: '删除附件',
        content: '确定删除这个已保存附件吗？删除后这条练习记录不再展示它。',
        confirmText: '删除',
        confirmColor: '#FF6A3D',
        success: (res) => resolve(res.confirm),
        fail: () => resolve(false)
      })
    })
    if (!confirmed) return
    const attachments = (selectedRecord.attachments || []).filter((item) => item.id !== selectedAttachment.id)
    try {
      const { updatePracticeRecord } = require('../../services/practice-record')
      await updatePracticeRecord(selectedRecord.id, { attachments })
      const nextRecord = Object.assign({}, selectedRecord, { attachments })
      this.setData({
        selectedRecord: nextRecord,
        selectedAttachment: null,
        attachmentVisible: false,
        records: this.data.records.map((item) => item.id === nextRecord.id ? normalizeRecordForView(nextRecord) : item)
      })
      toast('附件已删除')
    } catch (error) {
      toast('删除附件失败')
    }
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
