const { listPracticeRecords, updatePracticeRecord } = require('../../services/practice-record')
const { getMaterial, findLocalMaterial } = require('../../services/material')
const { getState, getThemeClass } = require('../../store/index')
const { getLayoutStyle } = require('../../utils/layout')
const { closeModal, openModal } = require('../../utils/modal')
const { getRouteParam, toast } = require('../../utils/page')

const FILTERS = [
  { value: 'all', label: '全部' },
  { value: 'video', label: '有视频' },
  { value: 'image', label: '有照片' },
  { value: 'audio', label: '有音频' },
  { value: 'markers', label: '关键时刻' },
  { value: 'high', label: '8-10 分' },
  { value: 'low', label: '1-4 分' }
]

const MARKER_KINDS = [
  { value: 'good', label: '做得好' },
  { value: 'issue', label: '待改进' },
  { value: 'reminder', label: '下次重点' },
  { value: 'neutral', label: '观察' }
]

function formatDate(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

function formatTime(value) {
  const seconds = Math.max(0, Math.floor(Number(value) || 0))
  const min = Math.floor(seconds / 60)
  const sec = seconds % 60
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

function toTimestamp(value) {
  if (!value) return 0
  if (Number.isFinite(Number(value))) return Number(value)
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 0 : date.getTime()
}

function markerKindLabel(kind) {
  const match = MARKER_KINDS.find((item) => item.value === kind)
  return match ? match.label : '观察'
}

function attachmentTypeLabel(type = '') {
  if (type === 'video') return '视频'
  if (type === 'audio') return '音频'
  return '照片'
}

function normalizeAttachment(attachment = {}) {
  const markers = Array.isArray(attachment.markers)
    ? attachment.markers.map((marker) => Object.assign({}, marker, {
      timeText: formatTime(marker.time),
      kindLabel: markerKindLabel(marker.kind)
    }))
    : []
  return Object.assign({}, attachment, {
    markers,
    markerCount: markers.length
  })
}

function markerCount(record = {}) {
  return (record.attachments || []).reduce((sum, attachment) => {
    return sum + (Array.isArray(attachment.markers) ? attachment.markers.length : 0)
  }, 0)
}

function getVideoAttachment(record = {}) {
  return (record.attachments || []).find((attachment) => attachment.type === 'video') || null
}

function buildFilterOptions(activeValue) {
  return FILTERS.map((item) => Object.assign({}, item, {
    activeClass: item.value === activeValue ? 'active' : ''
  }))
}

function buildMarkerKinds(activeValue) {
  return MARKER_KINDS.map((item) => Object.assign({}, item, {
    activeClass: item.value === activeValue ? 'active' : ''
  }))
}

function buildRecordView(record = {}, selectedIds = []) {
  const attachments = Array.isArray(record.attachments) ? record.attachments.map(normalizeAttachment) : []
  const markers = markerCount(record)
  const videoAttachment = attachments.find((attachment) => attachment.type === 'video') || null
  const audioAttachment = attachments.find((attachment) => attachment.type === 'audio') || null
  const score = Number(record.score) || 0
  const meta = []
  if (attachments.length) meta.push(`${attachments.length} 个附件`)
  if (videoAttachment) meta.push('有视频')
  if (audioAttachment) meta.push('有音频')
  if (markers) meta.push(`${markers} 个关键时刻`)
  if (Array.isArray(record.comparisonNotes) && record.comparisonNotes.length) meta.push(`${record.comparisonNotes.length} 条对比复盘`)
  return Object.assign({}, record, {
    attachments,
    markerCount: markers,
    videoAttachment,
    canCompare: !!videoAttachment,
    selected: selectedIds.includes(record.id),
    scoreText: score ? String(score) : '-',
    dateLabel: formatDate(record.createdAt || record.updatedAt),
    noteText: record.note || record.desc || '无复盘内容',
    meta,
    metaText: meta.length ? meta.join(' · ') : '暂无媒体证据',
    attachmentPreview: attachments.slice(0, 4).map((attachment) => ({
      id: attachment.id,
      type: attachment.type,
      typeLabel: attachmentTypeLabel(attachment.type),
      meta: attachment.type === 'video'
        ? (attachment.duration ? formatTime(attachment.duration) : '可回看')
        : attachment.type === 'audio'
          ? (attachment.duration ? formatTime(attachment.duration) : '可播放')
          : '查看'
    }))
  })
}

function filterRecords(records = [], activeFilter = 'all') {
  if (activeFilter === 'video') return records.filter((record) => !!getVideoAttachment(record))
  if (activeFilter === 'image') return records.filter((record) => (record.attachments || []).some((attachment) => attachment.type === 'image'))
  if (activeFilter === 'audio') return records.filter((record) => (record.attachments || []).some((attachment) => attachment.type === 'audio'))
  if (activeFilter === 'markers') return records.filter((record) => markerCount(record) > 0)
  if (activeFilter === 'high') return records.filter((record) => Number(record.score) >= 8)
  if (activeFilter === 'low') return records.filter((record) => Number(record.score) >= 1 && Number(record.score) <= 4)
  return records
}

function buildSummary(records = [], materialTitle = '素材记录') {
  const scored = records.filter((record) => Number(record.score) > 0)
  const avgScore = scored.length
    ? (scored.reduce((sum, record) => sum + Number(record.score || 0), 0) / scored.length).toFixed(1)
    : '-'
  const latest = records[0]
  const comparisons = records
    .reduce((items, record) => items.concat(Array.isArray(record.comparisonNotes) ? record.comparisonNotes : []), [])
    .filter(Boolean)
    .sort((a, b) => toTimestamp(b.createdAt) - toTimestamp(a.createdAt))
  return {
    materialTitle,
    avgScore,
    count: records.length,
    latestText: latest ? formatDate(latest.createdAt || latest.updatedAt) : '-',
    videoCount: records.filter((record) => !!getVideoAttachment(record)).length,
    markerCount: records.reduce((sum, record) => sum + markerCount(record), 0),
    latestComparison: comparisons[0]
      ? (comparisons[0].nextFocus || comparisons[0].improvement || comparisons[0].issue || '')
      : ''
  }
}

Page({
  data: {
    themeClass: 'theme-default',
    layoutStyle: '',
    materialId: '',
    materialTitle: '素材记录',
    allRecords: [],
    records: [],
    summary: buildSummary([]),
    loading: false,
    errorText: '',
    activeFilter: 'all',
    filterOptions: buildFilterOptions('all'),
    hasActiveFilter: false,
    modalOpen: false,
    detailVisible: false,
    videoVisible: false,
    audioVisible: false,
    compareVisible: false,
    selectedRecord: null,
    selectedAttachment: null,
    compareSelection: [],
    compareRecords: [],
    playbackRate: 1,
    currentVideoTime: 0,
    currentVideoTimeText: '00:00',
    markerDraftKind: 'issue',
    markerKinds: buildMarkerKinds('issue'),
    markerDraftNote: '',
    savingMarker: false,
    comparisonDraft: {
      improvement: '',
      issue: '',
      nextFocus: ''
    },
    savingComparison: false,
    isRefreshing: false
  },

  onLoad(options = {}) {
    const materialId = getRouteParam(options, 'materialId', '')
    const localMaterial = materialId ? (getState().materials || []).find((item) => item.id === materialId) || findLocalMaterial(materialId) : null
    this.setData({
      themeClass: getThemeClass(),
      layoutStyle: getLayoutStyle(),
      materialId,
      materialTitle: localMaterial ? localMaterial.title : '素材记录'
    })
    if (materialId) this.loadMaterialAndRecords()
  },

  onShow() {
    this.setData({ themeClass: getThemeClass() })
  },

  async onPullDownRefresh() {
    await this.loadMaterialAndRecords()
    this.setData({ isRefreshing: false })
    wx.stopPullDownRefresh()
  },

  back() {
    wx.navigateBack()
  },

  async loadMaterialAndRecords() {
    const materialId = this.data.materialId
    if (!materialId) return
    const localRecords = (getState().practiceRecordsHistory || []).filter((record) => record.materialId === materialId)
    this.applyRecords(localRecords, this.data.materialTitle)
    this.setData({ loading: true, errorText: '' })
    try {
      const [material, records] = await Promise.all([
        getMaterial(materialId).catch(() => null),
        listPracticeRecords({ materialId, limit: 100 })
      ])
      const materialTitle = material && material.title ? material.title : this.data.materialTitle
      const exactRecords = records.filter((record) => record.materialId === materialId)
      this.applyRecords(exactRecords, materialTitle)
      this.setData({ loading: false, errorText: '' })
    } catch (error) {
      this.setData({
        loading: false,
        errorText: '云端暂时不可用，当前只显示本次会话里的素材记录。'
      })
    }
  },

  applyRecords(records = [], materialTitle = this.data.materialTitle) {
    const sorted = records.slice().sort((a, b) => toTimestamp(b.createdAt || b.updatedAt) - toTimestamp(a.createdAt || a.updatedAt))
    const filtered = filterRecords(sorted, this.data.activeFilter)
    const selectedIds = this.data.compareSelection || []
    this.setData({
      materialTitle,
      allRecords: sorted,
      records: filtered.map((record) => buildRecordView(record, selectedIds)),
      summary: buildSummary(sorted, materialTitle),
      hasActiveFilter: this.data.activeFilter !== 'all',
      filterOptions: buildFilterOptions(this.data.activeFilter)
    })
  },

  setFilter(event) {
    const activeFilter = event.currentTarget.dataset.value || 'all'
    this.setData({
      activeFilter,
      filterOptions: buildFilterOptions(activeFilter)
    }, () => this.applyRecords(this.data.allRecords, this.data.materialTitle))
  },

  handleEmptyPrimary() {
    if (this.data.hasActiveFilter) {
      this.setData({ activeFilter: 'all' }, () => this.applyRecords(this.data.allRecords, this.data.materialTitle))
      return
    }
    wx.navigateBack()
  },

  findRecord(id) {
    return (this.data.allRecords || []).find((record) => record.id === id)
  },

  openRecord(event) {
    const id = event.currentTarget.dataset.id
    const record = this.findRecord(id)
    if (!record) return
    openModal(this, {
      detailVisible: true,
      selectedRecord: buildRecordView(record, this.data.compareSelection)
    })
  },

  closeDetail() {
    closeModal(this, {
      detailVisible: false,
      selectedRecord: null
    })
  },

  openAttachment(event) {
    const attachmentId = event.currentTarget.dataset.attachmentId
    const record = this.data.selectedRecord
    if (!record) return
    const attachment = (record.attachments || []).find((item) => item.id === attachmentId)
    if (!attachment) return
    if (attachment.type === 'audio') {
      openModal(this, {
        detailVisible: false,
        audioVisible: true,
        selectedAttachment: attachment
      })
      return
    }
    if (attachment.type !== 'video') {
      toast('照片暂只支持查看')
      return
    }
    openModal(this, {
      detailVisible: false,
      videoVisible: true,
      selectedAttachment: attachment,
      currentVideoTime: 0,
      currentVideoTimeText: '00:00',
      markerDraftNote: '',
      markerDraftKind: 'issue',
      markerKinds: buildMarkerKinds('issue'),
      playbackRate: 1
    })
  },

  closeVideo() {
    closeModal(this, {
      videoVisible: false,
      selectedAttachment: null,
      markerDraftNote: ''
    })
  },

  closeAudio() {
    closeModal(this, {
      audioVisible: false,
      selectedAttachment: null
    })
  },

  handleVideoTimeUpdate(event) {
    const currentTime = Number(event.detail.currentTime) || 0
    this.setData({
      currentVideoTime: currentTime,
      currentVideoTimeText: formatTime(currentTime)
    })
  },

  setPlaybackRate(event) {
    const rate = Number(event.currentTarget.dataset.rate) || 1
    const context = wx.createVideoContext('reviewVideo', this)
    if (context && typeof context.playbackRate === 'function') {
      context.playbackRate(rate)
    }
    this.setData({ playbackRate: rate })
  },

  setMarkerKind(event) {
    const markerDraftKind = event.currentTarget.dataset.kind || 'neutral'
    this.setData({
      markerDraftKind,
      markerKinds: buildMarkerKinds(markerDraftKind)
    })
  },

  updateMarkerNote(event) {
    this.setData({ markerDraftNote: event.detail.value || '' })
  },

  async saveMarker() {
    const record = this.data.selectedRecord
    const attachment = this.data.selectedAttachment
    const note = String(this.data.markerDraftNote || '').trim()
    if (!record || !attachment) return
    if (!note) {
      toast('先写一句关键时刻备注')
      return
    }
    const nextMarker = {
      id: `marker-${Date.now()}`,
      time: Math.max(0, Math.round(Number(this.data.currentVideoTime) || 0)),
      kind: this.data.markerDraftKind || 'neutral',
      note,
      createdAt: Date.now()
    }
    const sourceRecord = this.findRecord(record.id)
    if (!sourceRecord) return
    const attachments = (sourceRecord.attachments || []).map((item) => {
      if (item.id !== attachment.id) return item
      return Object.assign({}, item, {
        markers: (Array.isArray(item.markers) ? item.markers : []).concat(nextMarker)
      })
    })
    this.setData({ savingMarker: true })
    try {
      const response = await updatePracticeRecord(sourceRecord.id, { attachments })
      const updated = response && response.item ? Object.assign({}, sourceRecord, response.item, { attachments }) : Object.assign({}, sourceRecord, { attachments })
      const allRecords = (this.data.allRecords || []).map((item) => item.id === sourceRecord.id ? updated : item)
      const selectedRecord = buildRecordView(updated, this.data.compareSelection)
      const selectedAttachment = selectedRecord.attachments.find((item) => item.id === attachment.id)
      this.setData({
        allRecords,
        selectedRecord,
        selectedAttachment,
        markerDraftNote: '',
        savingMarker: false
      }, () => this.applyRecords(allRecords, this.data.materialTitle))
      toast('已添加关键时刻')
    } catch (error) {
      this.setData({ savingMarker: false })
      toast(error && error.message ? error.message : '关键时刻保存失败')
    }
  },

  seekMarker(event) {
    const time = Number(event.currentTarget.dataset.time) || 0
    const context = wx.createVideoContext('reviewVideo', this)
    if (context && typeof context.seek === 'function') context.seek(time)
    this.setData({
      currentVideoTime: time,
      currentVideoTimeText: formatTime(time)
    })
  },

  toggleCompareSelection(event) {
    const id = event.currentTarget.dataset.id
    const record = this.findRecord(id)
    if (!record || !getVideoAttachment(record)) {
      toast('只能选择含视频的记录')
      return
    }
    let compareSelection = this.data.compareSelection || []
    if (compareSelection.includes(id)) {
      compareSelection = compareSelection.filter((item) => item !== id)
    } else {
      if (compareSelection.length >= 2) {
        toast('最多选择 2 条记录')
        return
      }
      compareSelection = compareSelection.concat(id)
    }
    this.setData({ compareSelection }, () => this.applyRecords(this.data.allRecords, this.data.materialTitle))
  },

  openCompare() {
    if ((this.data.compareSelection || []).length !== 2) return
    const compareRecords = this.data.compareSelection
      .map((id) => this.findRecord(id))
      .filter(Boolean)
      .map((record) => buildRecordView(record, this.data.compareSelection))
    openModal(this, {
      compareVisible: true,
      compareRecords,
      comparisonDraft: {
        improvement: '',
        issue: '',
        nextFocus: ''
      }
    })
  },

  closeCompare() {
    closeModal(this, {
      compareVisible: false,
      compareRecords: []
    })
  },

  updateComparisonDraft(event) {
    const field = event.currentTarget.dataset.field
    this.setData({ [`comparisonDraft.${field}`]: event.detail.value || '' })
  },

  async saveComparison() {
    const compareRecords = this.data.compareRecords || []
    if (compareRecords.length !== 2) return
    const draft = this.data.comparisonDraft || {}
    const hasContent = String(draft.improvement || draft.issue || draft.nextFocus || '').trim()
    if (!hasContent) {
      toast('先写一条对比复盘')
      return
    }
    const target = compareRecords.slice().sort((a, b) => toTimestamp(b.createdAt || b.updatedAt) - toTimestamp(a.createdAt || a.updatedAt))[0]
    const sourceRecord = this.findRecord(target.id)
    if (!sourceRecord) return
    const comparisonNotes = (Array.isArray(sourceRecord.comparisonNotes) ? sourceRecord.comparisonNotes : []).concat({
      id: `comparison-${Date.now()}`,
      comparedRecordIds: compareRecords.map((record) => record.id),
      improvement: String(draft.improvement || '').trim(),
      issue: String(draft.issue || '').trim(),
      nextFocus: String(draft.nextFocus || '').trim(),
      createdAt: Date.now()
    })
    this.setData({ savingComparison: true })
    try {
      const response = await updatePracticeRecord(sourceRecord.id, { comparisonNotes })
      const updated = response && response.item ? Object.assign({}, sourceRecord, response.item, { comparisonNotes }) : Object.assign({}, sourceRecord, { comparisonNotes })
      const allRecords = (this.data.allRecords || []).map((item) => item.id === sourceRecord.id ? updated : item)
      this.setData({
        allRecords,
        compareSelection: [],
        compareVisible: false,
        compareRecords: [],
        savingComparison: false
      }, () => this.applyRecords(allRecords, this.data.materialTitle))
      toast('已保存对比复盘')
    } catch (error) {
      this.setData({ savingComparison: false })
      toast(error && error.message ? error.message : '对比复盘保存失败')
    }
  }
})
