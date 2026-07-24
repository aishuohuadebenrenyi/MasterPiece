const { listInspirations } = require('../../services/inspiration')
const { listPracticeRecords } = require('../../services/practice-record')
const { listRehearsals } = require('../../services/rehearsal')
const { listMethodCards } = require('../../services/method-card')
const { getState, getThemeClass } = require('../../store/index')
const { getLayoutStyle } = require('../../utils/layout')
const { closeModal, openModal } = require('../../utils/modal')
const { getRouteParam, toast } = require('../../utils/page')

const FILTERS = [
  { value: 'all', label: '全部' },
  { value: 'inspiration', label: '灵感' },
  { value: 'practice', label: '素材练习' },
  { value: 'rehearsal', label: '排练' },
  { value: 'method', label: '方法卡' },
  { value: 'media', label: '有媒体' },
  { value: 'pending', label: '待整理' }
]

function toTimestamp(value) {
  if (!value) return 0
  if (Number.isFinite(Number(value))) return Number(value)
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 0 : date.getTime()
}

function formatDate(value) {
  const timestamp = toTimestamp(value)
  if (!timestamp) return '-'
  const date = new Date(timestamp)
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

function buildFilterOptions(activeValue) {
  return FILTERS.map((item) => Object.assign({}, item, {
    activeClass: item.value === activeValue ? 'active' : ''
  }))
}

function attachmentMeta(attachments = []) {
  const list = Array.isArray(attachments) ? attachments : []
  if (!list.length) return { hasMedia: false, mediaText: '' }
  const imageCount = list.filter((item) => item.type === 'image').length
  const videoCount = list.filter((item) => item.type === 'video').length
  const audioCount = list.filter((item) => item.type === 'audio').length
  const parts = []
  if (imageCount) parts.push(`${imageCount} 张照片`)
  if (videoCount) parts.push(`${videoCount} 个视频`)
  if (audioCount) parts.push(`${audioCount} 段音频`)
  return { hasMedia: true, mediaText: parts.join(' · ') }
}

function buildRecordItem(source, type) {
  const createdAt = source.createdAt || source.updatedAt
  const base = {
    id: `${type}:${source.id || source._id || Date.now()}`,
    sourceId: source.id || source._id || '',
    type,
    createdAt,
    dateLabel: formatDate(createdAt),
    raw: source
  }
  if (type === 'inspiration') {
    const media = attachmentMeta(source.attachments)
    const meta = (source.meta || []).filter(Boolean)
    if (media.mediaText) meta.unshift(media.mediaText)
    return Object.assign({}, base, {
      typeLabel: '灵感',
      title: source.title || '未命名灵感',
      desc: source.desc || '无具体内容',
      meta: Array.from(new Set(meta)),
      hasMedia: media.hasMedia,
      pending: (source.meta || []).includes('待整理')
    })
  }
  if (type === 'practice') {
    const media = attachmentMeta(source.attachments)
    const meta = []
    if (source.materialTitle || source.title) meta.push(source.materialTitle || source.title)
    if (source.score) meta.push(`${source.score} 分`)
    if (media.mediaText) meta.push(media.mediaText)
    return Object.assign({}, base, {
      typeLabel: '素材练习',
      title: source.materialTitle || source.title || '未命名素材练习',
      desc: source.note || source.desc || '无复盘内容',
      meta,
      hasMedia: media.hasMedia,
      materialId: source.materialId || '',
      pending: true
    })
  }
  if (type === 'rehearsal') {
    return Object.assign({}, base, {
      typeLabel: '排练',
      title: source.title || source.teamName || '未命名排练',
      desc: source.reviewReminder || source.reviewKeep || source.reviewTry || source.desc || '无复盘内容',
      meta: (source.meta || []).filter(Boolean),
      hasMedia: false,
      pending: source.status === '已完成'
    })
  }
  return Object.assign({}, base, {
    typeLabel: '方法卡',
    title: source.title || '未命名方法卡',
    desc: source.desc || '无具体内容',
    meta: [source.type, source.sourceTitle].concat(source.meta || []).filter(Boolean),
    hasMedia: false,
    pending: false
  })
}

function buildItems({ inspirations = [], practiceRecords = [], rehearsals = [], methodCards = [] } = {}) {
  return []
    .concat(inspirations.map((item) => buildRecordItem(item, 'inspiration')))
    .concat(practiceRecords.map((item) => buildRecordItem(item, 'practice')))
    .concat(rehearsals.map((item) => buildRecordItem(item, 'rehearsal')))
    .concat(methodCards.map((item) => buildRecordItem(item, 'method')))
    .sort((a, b) => toTimestamp(b.createdAt) - toTimestamp(a.createdAt))
}

function filterItems(items = [], activeFilter = 'all') {
  if (activeFilter === 'all') return items
  if (activeFilter === 'media') return items.filter((item) => item.hasMedia)
  if (activeFilter === 'pending') return items.filter((item) => item.pending)
  return items.filter((item) => item.type === activeFilter)
}

function uniqueById(items = []) {
  return items.reduce((result, item) => {
    const id = item && (item.id || item._id)
    if (!id || !result.some((entry) => (entry.id || entry._id) === id)) result.push(item)
    return result
  }, [])
}

Page({
  data: {
    themeClass: 'theme-default',
    layoutStyle: '',
    loading: false,
    errorText: '',
    activeFilter: 'all',
    filterOptions: buildFilterOptions('all'),
    allItems: [],
    items: [],
    summary: {
      total: 0,
      inspiration: 0,
      practice: 0,
      rehearsal: 0,
      method: 0
    },
    modalOpen: false,
    detailVisible: false,
    selectedItem: null,
    isRefreshing: false
  },

  onLoad(options = {}) {
    const filter = getRouteParam(options, 'filter', 'all')
    const activeFilter = FILTERS.some((item) => item.value === filter) ? filter : 'all'
    this.setData({
      themeClass: getThemeClass(),
      layoutStyle: getLayoutStyle(),
      activeFilter,
      filterOptions: buildFilterOptions(activeFilter)
    })
    this.loadRecords()
  },

  onShow() {
    this.setData({ themeClass: getThemeClass() })
  },

  async onPullDownRefresh() {
    await this.loadRecords()
    this.setData({ isRefreshing: false })
    wx.stopPullDownRefresh()
  },

  back() {
    wx.navigateBack()
  },

  buildLocalItems() {
    const state = getState()
    return buildItems({
      inspirations: state.todayInspirations || [],
      practiceRecords: state.practiceRecordsHistory || [],
      rehearsals: uniqueById([].concat(state.rehearsalHistory || [], state.todayRehearsals || [])),
      methodCards: state.methodCards || []
    })
  },

  async loadRecords() {
    const localItems = this.buildLocalItems()
    this.applyItems(localItems)
    this.setData({ loading: true, errorText: '' })
    try {
      const [inspirations, practiceRecords, rehearsals, methodCards] = await Promise.all([
        listInspirations({ limit: 100 }),
        listPracticeRecords({ limit: 100 }),
        listRehearsals({ limit: 100 }, { silent: true }),
        listMethodCards({ limit: 100 })
      ])
      this.applyItems(buildItems({ inspirations, practiceRecords, rehearsals, methodCards }))
      this.setData({ loading: false, errorText: '' })
    } catch (error) {
      this.setData({
        loading: false,
        errorText: '云端暂时不可用，当前只显示本次会话里的记录。'
      })
    }
  },

  applyItems(allItems = []) {
    const summary = {
      total: allItems.length,
      inspiration: allItems.filter((item) => item.type === 'inspiration').length,
      practice: allItems.filter((item) => item.type === 'practice').length,
      rehearsal: allItems.filter((item) => item.type === 'rehearsal').length,
      method: allItems.filter((item) => item.type === 'method').length
    }
    this.setData({
      allItems,
      items: filterItems(allItems, this.data.activeFilter),
      summary,
      filterOptions: buildFilterOptions(this.data.activeFilter)
    })
  },

  setFilter(event) {
    const activeFilter = event.currentTarget.dataset.value || 'all'
    this.setData({
      activeFilter,
      filterOptions: buildFilterOptions(activeFilter)
    }, () => this.applyItems(this.data.allItems))
  },

  handleEmptyPrimary() {
    this.setData({
      activeFilter: 'all',
      filterOptions: buildFilterOptions('all')
    }, () => this.applyItems(this.data.allItems))
  },

  openDetail(event) {
    const id = event.currentTarget.dataset.id
    const selectedItem = (this.data.allItems || []).find((item) => item.id === id)
    if (!selectedItem) return
    openModal(this, {
      detailVisible: true,
      selectedItem
    })
  },

  closeDetail() {
    closeModal(this, {
      detailVisible: false,
      selectedItem: null
    })
  },

  openMaterialRecords() {
    const item = this.data.selectedItem
    if (!item || !item.materialId) {
      toast('这条记录没有关联素材')
      return
    }
    wx.navigateTo({ url: `/pages/material-records/index?materialId=${item.materialId}` })
  }
})
