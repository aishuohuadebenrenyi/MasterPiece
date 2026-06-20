const { createMethodCard, listMethodCards, deleteMethodCard, updateMethodCard } = require('../../services/method-card')
const { listInspirations, deleteInspiration, updateInspiration } = require('../../services/inspiration')
const { listRehearsals } = require('../../services/rehearsal')
const { listPracticeRecords } = require('../../services/practice-record')
const { DEFAULT_PROFILE, deleteAccount, getProfile, normalizeProfile, updateProfile } = require('../../services/profile')
const { addMethodCard, getState, getThemeClass, setDismissedPendingKeys, setPendingIntentMarks, setState, toggleThemeMode } = require('../../store/index')
const { closeModal, openModal } = require('../../utils/modal')
const { syncTabBar } = require('../../utils/tabbar')
const { getLayoutStyle } = require('../../utils/layout')
const { buildSummaryRecordCardViewModel } = require('../../utils/record-card')
const { toast } = require('../../utils/page')

function computeProfileTags(troupeName) {
  const tag1 = (troupeName || '').trim() ? troupeName.trim() : '即兴主理人'
  return [tag1, '个人空间']
}

function getRehearsalCount(rehearsals = []) {
  return rehearsals.length
}

function getAvatarText(displayName = '') {
  const source = (displayName || DEFAULT_PROFILE.displayName).trim()
  if (!source) return 'IM'
  return source.slice(0, 2).toUpperCase()
}

function normalizeMethodSourceType(sourceType = '') {
  if (sourceType === 'inspiration') return 'inspiration'
  if (sourceType === 'practiceRecord') return 'practiceRecord'
  if (sourceType === 'rehearsalReview' || sourceType === 'rehearsal') return 'rehearsalReview'
  return sourceType || 'manual'
}

function getSourceLabel(sourceType = '') {
  const normalized = normalizeMethodSourceType(sourceType)
  if (normalized === 'inspiration') return '灵感'
  if (normalized === 'practiceRecord') return '素材练习'
  if (normalized === 'rehearsalReview') return '排练复盘'
  return '方法卡'
}

function getSourceKey(item = {}) {
  const sourceType = normalizeMethodSourceType(item.sourceType)
  const sourceId = item.sourceId || item.id
  if (sourceId) return `${sourceType}:${sourceId}`
  return `${sourceType}:${item.sourceTitle || item.title || ''}`
}

function filterItemMeta(item = {}) {
  return (item.meta || []).filter((entry) => entry && entry !== item.type)
}

function getCardBadgeTone(type = '') {
  if (type === '素材练习') return 'orange'
  if (type === '排练复盘') return 'mint'
  return 'blue'
}

function attachSummaryCardView(item = {}) {
  const badgeTone = getCardBadgeTone(item.type)
  return Object.assign({}, item, {
    badgeTone,
    cardView: buildSummaryRecordCardViewModel(Object.assign({}, item, {
      badgeTone
    }))
  })
}

function normalizePendingItem(item, sourceType) {
  const label = getSourceLabel(sourceType)
  const title = item.title || (sourceType === 'practiceRecord' ? '未命名练习记录' : '未命名记录')
  const desc = item.desc
    || (sourceType === 'practiceRecord'
      ? `Keep: ${item.keep || '待整理'}\nTry: ${item.try || '待整理'}`
      : item.reviewReminder || item.summary || '待整理')
  const meta = Array.isArray(item.meta) ? item.meta : []
  return Object.assign({}, item, {
    id: item.id || item._id || `${sourceType}-${Date.now()}`,
    type: label,
    sourceType,
    sourceId: item.id || item._id,
    sourceTitle: title,
    title,
    desc,
    meta: [label].concat(meta.filter((entry) => entry !== label)),
    filteredMeta: meta.filter((entry) => entry && entry !== label)
  })
}

function buildPendingItems({ inspirations = [], rehearsals = [], practiceRecords = [], sediments = [] } = {}) {
  const existing = new Set(sediments.map(getSourceKey))
  const candidates = []
    .concat(inspirations.map((item) => normalizePendingItem(item, 'inspiration')))
    .concat(practiceRecords.map((item) => normalizePendingItem(item, 'practiceRecord')))
    .concat(rehearsals
      .filter((item) => item.status === '已完成' || item.reviewKeep || item.reviewTry || item.reviewReminder)
      .map((item) => normalizePendingItem(item, 'rehearsalReview')))
  return candidates.filter((item) => !existing.has(getSourceKey(item)))
}

function buildMethodFilterOptions(sediments = [], activeFilter = 'all') {
  const sourceTypes = Array.from(new Set(sediments.map((item) => normalizeMethodSourceType(item.sourceType))))
    .filter((item) => item && item !== 'manual')
  const options = [{ value: 'all', label: '全部' }].concat(sourceTypes.map((value) => ({
    value,
    label: getSourceLabel(value)
  })))
  return options.map((item) => Object.assign({}, item, {
    activeClass: activeFilter === item.value ? 'active' : ''
  }))
}

function filterSediments(sediments = [], methodFilter = 'all') {
  if (methodFilter === 'all') return sediments
  return sediments.filter((item) => normalizeMethodSourceType(item.sourceType) === methodFilter)
}

function getIntentLabel(intent = '') {
  return intent === 'rehearsal' ? '排练线索' : '训练线索'
}

function getIntentMap(pendingIntentMarks = []) {
  const intentMap = {}
  pendingIntentMarks.forEach((item) => {
    if (item && item.key) intentMap[item.key] = item.intent
  })
  return intentMap
}

function buildInspirationFilterOptions(activeFilter = 'all') {
  return [
    { value: 'all', label: '全部' },
    { value: 'pending', label: '待整理' },
    { value: 'training', label: '训练线索' },
    { value: 'rehearsal', label: '排练线索' },
    { value: 'sedimented', label: '已沉淀' }
  ].map((item) => Object.assign({}, item, {
    activeClass: activeFilter === item.value ? 'active' : ''
  }))
}

function filterInspirations(inspirations = [], inspirationFilter = 'all', { sediments = [], discardedPendingKeys = [], pendingIntentMarks = [] } = {}) {
  if (inspirationFilter === 'all') return inspirations
  const sedimented = new Set(sediments.map(getSourceKey))
  const discarded = new Set(discardedPendingKeys)
  const intentMap = getIntentMap(pendingIntentMarks)
  return inspirations.filter((item) => {
    const key = getSourceKey(item)
    if (inspirationFilter === 'sedimented') return sedimented.has(key)
    if (inspirationFilter === 'training' || inspirationFilter === 'rehearsal') return intentMap[key] === inspirationFilter
    if (inspirationFilter === 'pending') return !sedimented.has(key) && !discarded.has(key) && !intentMap[key]
    return true
  })
}

function normalizeDetailIndex(index, items = []) {
  if (!Array.isArray(items) || !items.length) return 0
  const numericIndex = Number(index)
  if (!Number.isFinite(numericIndex)) return 0
  if (numericIndex < 0) return 0
  if (numericIndex >= items.length) return items.length - 1
  return numericIndex
}

function buildMineViewData({ sediments = [], inspirations = [], rehearsals = [], practiceRecords = [], playedCount = 0, layoutStyle = '', profile, methodFilter = 'all', inspirationFilter = 'all', discardedPendingKeys = [], pendingIntentMarks = [] } = {}) {
  const mappedSediments = sediments.map(item => attachSummaryCardView(Object.assign({}, item, {
    sourceType: normalizeMethodSourceType(item.sourceType),
    type: item.type || getSourceLabel(item.sourceType),
    filteredMeta: filterItemMeta(Object.assign({}, item, {
      type: item.type || getSourceLabel(item.sourceType)
    }))
  })))
  const mappedInspirations = inspirations.map((item) => attachSummaryCardView(Object.assign({}, item, {
    sourceType: item.sourceType || 'inspiration',
    type: item.type || '灵感',
    filteredMeta: filterItemMeta(Object.assign({}, item, {
      type: item.type || '灵感'
    }))
  })))
  const discarded = new Set(discardedPendingKeys)
  const intentMarked = new Set((pendingIntentMarks || []).map((item) => item.key).filter(Boolean))
  const pendingItems = buildPendingItems({ inspirations: mappedInspirations, rehearsals, practiceRecords, sediments: mappedSediments })
    .filter((item) => {
      const key = getSourceKey(item)
      return !discarded.has(key) && !intentMarked.has(key)
    })
    .map((item) => attachSummaryCardView(item))
  const totalRecords = mappedInspirations.length + getRehearsalCount(rehearsals) + mappedSediments.length + (practiceRecords.length || 0)
  const methodCount = mappedSediments.length
  const rehearsalCount = getRehearsalCount(rehearsals)
  const practiceRecordsCount = practiceRecords.length || 0
  const showIntroState = methodCount === 0 && mappedInspirations.length === 0 && rehearsalCount === 0 && practiceRecordsCount === 0
  const showPendingCard = pendingItems.length > 0
  const showSedimentsCard = methodCount > 0
  const showInspirationsCard = mappedInspirations.length > 0
  const showPracticeRecordsCard = practiceRecordsCount > 0
  const showRehearsalCard = rehearsalCount > 0
  const showStatsCard = !showIntroState && (totalRecords > 1 || playedCount > 0 || methodCount > 0)
  const nextProfile = normalizeProfile(profile || DEFAULT_PROFILE)
  return {
    sediments: mappedSediments,
    inspirations: mappedInspirations,
    rehearsals,
    practiceRecords,
    pendingItems,
    pendingCount: pendingItems.length,
    totalRecords,
    playedCount,
    methodCount,
    rehearsalCount,
    practiceRecordsCount,
    showIntroState,
    showPendingCard,
    showSedimentsCard,
    showInspirationsCard,
    showPracticeRecordsCard,
    showRehearsalCard,
    showStatsCard,
    layoutStyle,
    profileName: nextProfile.displayName,
    profileAvatar: nextProfile.avatarUrl,
    profileAvatarText: getAvatarText(nextProfile.displayName),
    profileTroupeName: nextProfile.troupeName,
    profileTags: computeProfileTags(nextProfile.troupeName),
    methodFilterOptions: buildMethodFilterOptions(mappedSediments, methodFilter),
    inspirationFilterOptions: buildInspirationFilterOptions(inspirationFilter)
  }
}

function getListItemsForKind(kind, data, overrides = {}) {
  const methodFilter = Object.prototype.hasOwnProperty.call(overrides, 'methodFilter') ? overrides.methodFilter : data.methodFilter
  const inspirationFilter = Object.prototype.hasOwnProperty.call(overrides, 'inspirationFilter') ? overrides.inspirationFilter : data.inspirationFilter
  const sediments = Object.prototype.hasOwnProperty.call(overrides, 'sediments') ? overrides.sediments : data.sediments
  const inspirations = Object.prototype.hasOwnProperty.call(overrides, 'inspirations') ? overrides.inspirations : data.inspirations
  const pendingItems = Object.prototype.hasOwnProperty.call(overrides, 'pendingItems') ? overrides.pendingItems : data.pendingItems
  const discardedPendingKeys = Object.prototype.hasOwnProperty.call(overrides, 'discardedPendingKeys') ? overrides.discardedPendingKeys : data.discardedPendingKeys
  const pendingIntentMarks = Object.prototype.hasOwnProperty.call(overrides, 'pendingIntentMarks') ? overrides.pendingIntentMarks : data.pendingIntentMarks
  if (kind === 'sediments') return filterSediments(sediments, methodFilter)
  if (kind === 'pending') return pendingItems
  return filterInspirations(inspirations, inspirationFilter, { sediments, discardedPendingKeys, pendingIntentMarks })
}

Page({
  data: {
    sediments: [],
    inspirations: [],
    rehearsals: [],
    practiceRecords: [],
    pendingItems: [],
    pendingCount: 0,
    discardedPendingKeys: [],
    pendingIntentMarks: [],
    totalRecords: 0,
    playedCount: 0,
    methodCount: 0,
    rehearsalCount: 0,
    practiceRecordsCount: 0,
    listVisible: false,
    detailVisible: false,
    listTitle: '',
    detailTitle: '',
    currentKind: 'sediments',
    methodFilter: 'all',
    inspirationFilter: 'all',
    methodFilterOptions: [],
    inspirationFilterOptions: [],
    pillClass: 'orange',
    modalOpen: false,
    currentIndex: 0,
    listItems: [],
    detailItem: null,
    detailCount: '1 / 1',
    detailCanSediment: false,
    sedimentSaving: false,
    layoutStyle: '',
    themeClass: 'theme-default',
    loadErrorText: '',
    showIntroState: false,
    profileName: DEFAULT_PROFILE.displayName,
    profileAvatar: DEFAULT_PROFILE.avatarUrl,
    profileAvatarText: getAvatarText(DEFAULT_PROFILE.displayName),
    profileTroupeName: DEFAULT_PROFILE.troupeName,
    profileTags: computeProfileTags(DEFAULT_PROFILE.troupeName),
    profileEditVisible: false,
    profileDraftName: DEFAULT_PROFILE.displayName,
    profileDraftTroupeName: DEFAULT_PROFILE.troupeName,
    profileDraftTags: computeProfileTags(DEFAULT_PROFILE.troupeName),
    profileDraftAvatar: DEFAULT_PROFILE.avatarUrl,
    profileDraftAvatarText: getAvatarText(DEFAULT_PROFILE.displayName),
    profileDraftAvatarTemp: '',
    profileSaving: false,
    showPendingCard: false,
    showSedimentsCard: false,
    showInspirationsCard: false,
    showPracticeRecordsCard: false,
    showRehearsalCard: false,
    showStatsCard: false,
    privacyVisible: false,
    editingMethodCardId: '',
    methodCardDraftTitle: '',
    methodCardDraftContent: '',
    showMethodCardEditSheet: false,
    isRefreshing: false
  },

  unsubscribePrivacy: null,

  onShareAppMessage() {
    return {
      title: '即兴工具箱 — 找素材·快记录·可沉淀',
      path: '/pages/discover/index',
      imageUrl: '/assets/share/share-brand.png'
    }
  },

  onLoad() {
    this.setData({
      layoutStyle: getLayoutStyle(),
      themeClass: getThemeClass()
    })
    const app = getApp()
    if (app.subscribePrivacy) {
      this.unsubscribePrivacy = app.subscribePrivacy(() => {
        this.setData({ privacyVisible: true })
      })
    }
  },

  onUnload() {
    if (this.unsubscribePrivacy) this.unsubscribePrivacy()
  },

  onPrivacyAgree() {
    const app = getApp()
    if (app.onPrivacyAgree) app.onPrivacyAgree()
    this.setData({ privacyVisible: false })
  },

  onPrivacyRefuse() {
    const app = getApp()
    if (app.onPrivacyRefuse) app.onPrivacyRefuse()
    this.setData({ privacyVisible: false })
  },

  async loadAllData() {
    syncTabBar(this, 2)
    const state = getState()
    const localSediments = state.methodCards || []
    const localInspirations = state.todayInspirations || []
    const localRehearsals = state.rehearsalHistory || []
    const localPracticeRecords = state.practiceRecordsHistory || []
    this.setData(Object.assign({}, buildMineViewData({
      sediments: localSediments,
      inspirations: localInspirations,
      rehearsals: localRehearsals,
      practiceRecords: localPracticeRecords,
      playedCount: (state.playedMaterialIds || []).length,
      layoutStyle: getLayoutStyle(),
      profile: state.profile || DEFAULT_PROFILE,
      methodFilter: this.data.methodFilter,
      inspirationFilter: this.data.inspirationFilter,
      discardedPendingKeys: state.dismissedPendingKeys || this.data.discardedPendingKeys,
      pendingIntentMarks: state.pendingIntentMarks || this.data.pendingIntentMarks
    }), {
      themeClass: getThemeClass()
    }))
    const [sedimentsResult, inspirationsResult, rehearsalsResult, practiceRecordsResult, profileResult] = await Promise.allSettled([
      listMethodCards(),
      listInspirations(),
      listRehearsals(),
      listPracticeRecords(),
      getProfile()
    ])
    const hasLoadError = [sedimentsResult, inspirationsResult, rehearsalsResult, practiceRecordsResult, profileResult]
      .some((result) => result.status === 'rejected')
    this.setData(buildMineViewData({
      sediments: sedimentsResult.status === 'fulfilled' ? sedimentsResult.value : localSediments,
      inspirations: inspirationsResult.status === 'fulfilled' ? inspirationsResult.value : localInspirations,
      rehearsals: rehearsalsResult.status === 'fulfilled' ? rehearsalsResult.value : localRehearsals,
      practiceRecords: practiceRecordsResult.status === 'fulfilled' ? practiceRecordsResult.value : localPracticeRecords,
      playedCount: (state.playedMaterialIds || []).length,
      layoutStyle: getLayoutStyle(),
      profile: profileResult.status === 'fulfilled' ? profileResult.value : (state.profile || DEFAULT_PROFILE),
      methodFilter: this.data.methodFilter,
      inspirationFilter: this.data.inspirationFilter,
      discardedPendingKeys: getState().dismissedPendingKeys || this.data.discardedPendingKeys,
      pendingIntentMarks: getState().pendingIntentMarks || this.data.pendingIntentMarks
    }))
    this.setData({ loadErrorText: hasLoadError ? '部分云端数据加载失败，下拉可重试。' : '' })
  },

  async onShow() {
    await this.loadAllData()
  },

  onScroll(e) {
    const deltaY = e.detail.deltaY
    if (Math.abs(deltaY) > 10) {
      const tabbar = this.getTabBar()
      if (tabbar && typeof tabbar.setHidden === 'function') {
        tabbar.setHidden(deltaY > 0)
      }
    }
  },

  async onPullDownRefresh() {
    await this.loadAllData()
    this.setData({ isRefreshing: false })
    wx.stopPullDownRefresh()
  },

  refreshMineView(overrides = {}, callback) {
    const hasOwn = (key) => Object.prototype.hasOwnProperty.call(overrides, key)
    const nextSediments = hasOwn('sediments') ? overrides.sediments : this.data.sediments
    const nextInspirations = hasOwn('inspirations') ? overrides.inspirations : this.data.inspirations
    const nextRehearsals = hasOwn('rehearsals') ? overrides.rehearsals : this.data.rehearsals
    const nextPracticeRecords = hasOwn('practiceRecords') ? overrides.practiceRecords : this.data.practiceRecords
    const nextMethodFilter = hasOwn('methodFilter') ? overrides.methodFilter : this.data.methodFilter
    const nextInspirationFilter = hasOwn('inspirationFilter') ? overrides.inspirationFilter : this.data.inspirationFilter
    const nextDiscardedPendingKeys = hasOwn('discardedPendingKeys') ? overrides.discardedPendingKeys : this.data.discardedPendingKeys
    const nextPendingIntentMarks = hasOwn('pendingIntentMarks') ? overrides.pendingIntentMarks : this.data.pendingIntentMarks
    const nextProfile = {
      displayName: hasOwn('profileName') ? overrides.profileName : this.data.profileName,
      avatarUrl: hasOwn('profileAvatar') ? overrides.profileAvatar : this.data.profileAvatar,
      troupeName: hasOwn('profileTroupeName') ? overrides.profileTroupeName : this.data.profileTroupeName
    }
    const nextViewData = buildMineViewData({
      sediments: nextSediments,
      inspirations: nextInspirations,
      rehearsals: nextRehearsals,
      practiceRecords: nextPracticeRecords,
      playedCount: this.data.playedCount,
      layoutStyle: this.data.layoutStyle,
      profile: nextProfile,
      methodFilter: nextMethodFilter,
      inspirationFilter: nextInspirationFilter,
      discardedPendingKeys: nextDiscardedPendingKeys,
      pendingIntentMarks: nextPendingIntentMarks
    })
    const nextListItems = getListItemsForKind(this.data.currentKind, this.data, Object.assign({}, nextViewData, {
      methodFilter: nextMethodFilter,
      inspirationFilter: nextInspirationFilter,
      discardedPendingKeys: nextDiscardedPendingKeys,
      pendingIntentMarks: nextPendingIntentMarks
    }))
    this.setData(Object.assign({}, nextViewData, overrides, {
      listItems: nextListItems
    }), callback)
  },

  openList(event) {
    const kind = event.currentTarget.dataset.kind
    const listItems = getListItemsForKind(kind, this.data)
    openModal(this, {
      listVisible: true,
      detailVisible: false,
      listTitle: kind === 'sediments' ? '个人沉淀' : (kind === 'pending' ? '待整理' : '灵感记录'),
      currentKind: kind,
      pillClass: kind === 'sediments' ? 'orange' : (kind === 'pending' ? 'mint' : 'blue'),
      listItems
    })
  },

  filterMethodCards(event) {
    const methodFilter = event.currentTarget.dataset.filter || 'all'
    this.setData({
      methodFilter,
      methodFilterOptions: buildMethodFilterOptions(this.data.sediments, methodFilter),
      listItems: this.data.currentKind === 'sediments'
        ? filterSediments(this.data.sediments, methodFilter)
        : this.data.listItems
    })
  },

  filterInspirations(event) {
    const inspirationFilter = event.currentTarget.dataset.filter || 'all'
    this.setData({
      inspirationFilter,
      inspirationFilterOptions: buildInspirationFilterOptions(inspirationFilter),
      listItems: this.data.currentKind === 'inspirations'
        ? filterInspirations(this.data.inspirations, inspirationFilter, {
          sediments: this.data.sediments,
          discardedPendingKeys: this.data.discardedPendingKeys,
          pendingIntentMarks: this.data.pendingIntentMarks
        })
        : this.data.listItems
    })
  },

  closeSheet() {
    closeModal(this, {
      listVisible: false,
      detailVisible: false,
      profileEditVisible: false,
      profileSaving: false,
      sedimentSaving: false
    })
  },

  closeDetail() {
    closeModal(this, { detailVisible: false, detailItem: null, detailCanSediment: false, sedimentSaving: false })
  },

  noop() {},

  openDetail(event) {
    const items = getListItemsForKind(this.data.currentKind, this.data)
    const targetId = event.detail && event.detail.id
      ? event.detail.id
      : ''
    const rawIndex = targetId
      ? items.findIndex((item) => item.id === targetId)
      : Number(event.currentTarget.dataset.index)
    const currentIndex = normalizeDetailIndex(rawIndex, items)
    openModal(this, {
      currentIndex,
      listVisible: false,
      detailVisible: true
    }, () => {
      this.syncDetail()
    })
  },

  syncDetail() {
    const items = getListItemsForKind(this.data.currentKind, this.data)
    if (!items.length) {
      this.setData({
        detailItem: null,
        detailCount: '0 / 0',
        detailCanSediment: false
      })
      return
    }
    const currentIndex = normalizeDetailIndex(this.data.currentIndex, items)
    const detailItem = items[currentIndex] || items[0]
    this.setData({
      currentIndex,
      detailItem,
      detailTitle: this.data.currentKind === 'sediments' ? '沉淀详情' : (this.data.currentKind === 'pending' ? '待整理详情' : '灵感详情'),
      detailCount: `${currentIndex + 1} / ${items.length}`,
      detailCanSediment: this.data.currentKind === 'pending'
    })
  },

  moveDetail(event) {
    const step = Number(event.currentTarget.dataset.step)
    const items = getListItemsForKind(this.data.currentKind, this.data)
    if (!items.length) return
    const currentIndex = normalizeDetailIndex(this.data.currentIndex, items)
    const next = (currentIndex + step + items.length) % items.length
    this.setData({ currentIndex: next }, () => this.syncDetail())
  },

  prevDetail() {
    const items = getListItemsForKind(this.data.currentKind, this.data)
    if (!items.length) return
    const currentIndex = normalizeDetailIndex(this.data.currentIndex, items)
    const next = (currentIndex - 1 + items.length) % items.length
    this.setData({ currentIndex: next }, () => this.syncDetail())
  },

  nextDetail() {
    const items = getListItemsForKind(this.data.currentKind, this.data)
    if (!items.length) return
    const currentIndex = normalizeDetailIndex(this.data.currentIndex, items)
    const next = (currentIndex + 1) % items.length
    this.setData({ currentIndex: next }, () => this.syncDetail())
  },

  discardCurrentDetail() {
    const source = this.data.detailItem
    if (!source || this.data.currentKind !== 'pending') return
    const sourceKey = getSourceKey(source)
    const discardedPendingKeys = Array.from(new Set((this.data.discardedPendingKeys || []).concat(sourceKey)))
    setDismissedPendingKeys(discardedPendingKeys)
    const nextPendingItems = this.data.pendingItems.filter((entry) => getSourceKey(entry) !== sourceKey)
    if (!nextPendingItems.length) {
      this.refreshMineView({
        discardedPendingKeys,
        currentIndex: 0
      })
      this.closeDetail()
      toast('已不再整理，原记录仍保留')
      return
    }
    const currentIndex = Math.min(this.data.currentIndex, nextPendingItems.length - 1)
    this.refreshMineView({
      discardedPendingKeys,
      currentIndex
    }, () => this.syncDetail())
    toast('已不再整理，原记录仍保留')
  },

  markCurrentDetailIntent(event) {
    const source = this.data.detailItem
    const intent = event.detail && event.detail.intent === 'rehearsal' ? 'rehearsal' : 'training'
    if (!source || this.data.currentKind !== 'pending' || normalizeMethodSourceType(source.sourceType) !== 'inspiration') return
    const sourceKey = getSourceKey(source)
    const pendingIntentMarks = (this.data.pendingIntentMarks || []).filter((entry) => entry.key !== sourceKey)
      .concat({ key: sourceKey, intent })
    setPendingIntentMarks(pendingIntentMarks)
    const nextPendingItems = this.data.pendingItems.filter((entry) => getSourceKey(entry) !== sourceKey)
    if (!nextPendingItems.length) {
      this.refreshMineView({
        pendingIntentMarks,
        currentIndex: 0
      })
      this.closeDetail()
      toast(`已标记为${getIntentLabel(intent)}，原记录仍保留`)
      return
    }
    const currentIndex = Math.min(this.data.currentIndex, nextPendingItems.length - 1)
    this.refreshMineView({
      pendingIntentMarks,
      currentIndex
    }, () => this.syncDetail())
    toast(`已标记为${getIntentLabel(intent)}，原记录仍保留`)
  },

  async sedimentCurrentDetail() {
    const source = this.data.detailItem
    if (!source || this.data.sedimentSaving) return
    const sourceType = normalizeMethodSourceType(source.sourceType)
    const sourceLabel = getSourceLabel(sourceType)
    const item = {
      id: `method-${Date.now()}`,
      type: sourceLabel,
      title: source.title || '未命名方法卡',
      desc: source.desc || '待补充',
      meta: [sourceLabel].concat((source.meta || []).filter((entry) => entry !== sourceLabel)).concat('可复用'),
      sourceType,
      sourceId: source.sourceId || source.id,
      sourceTitle: source.title
    }
    this.setData({ sedimentSaving: true })
    try {
      const result = await createMethodCard({
        id: item.id,
        sourceType: item.sourceType,
        sourceId: item.sourceId,
        sourceTitle: item.sourceTitle,
        type: item.type,
        title: item.title,
        desc: item.desc,
        meta: item.meta
      })
      addMethodCard(result.item)
      const sourceKey = getSourceKey(source)
      const sediments = [item].concat(this.data.sediments)
      const discardedPendingKeys = Array.from(new Set((this.data.discardedPendingKeys || []).concat(sourceKey)))
      setDismissedPendingKeys(discardedPendingKeys)
      this.refreshMineView({
        sediments,
        discardedPendingKeys,
        sedimentSaving: false
      })
      this.closeDetail()
      toast('已沉淀为方法卡')
    } catch (error) {
      this.setData({ sedimentSaving: false })
      toast('沉淀失败，请重试')
    }
  },

  openTeamRecords() {
    wx.navigateTo({ url: '/pages/team-records/index' })
  },

  openPracticeRecords() {
    wx.navigateTo({ url: '/pages/practice-records/index' })
  },

  openEditProfile() {
    openModal(this, {
      profileEditVisible: true,
      profileDraftName: this.data.profileName,
      profileDraftTroupeName: this.data.profileTroupeName,
      profileDraftTags: computeProfileTags(this.data.profileTroupeName),
      profileDraftAvatar: this.data.profileAvatar,
      profileDraftAvatarText: this.data.profileAvatarText,
      profileDraftAvatarTemp: '',
      profileSaving: false
    })
  },

  updateProfileName(event) {
    const profileDraftName = event.detail.value || ''
    this.setData({
      profileDraftName,
      profileDraftAvatarText: getAvatarText(profileDraftName)
    })
  },

  updateProfileTroupeName(event) {
    const profileDraftTroupeName = event.detail.value || ''
    this.setData({
      profileDraftTroupeName,
      profileDraftTags: computeProfileTags(profileDraftTroupeName)
    })
  },

  async chooseProfileAvatar() {
    try {
      const result = await wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: ['album', 'camera']
      })
      const file = result.tempFiles && result.tempFiles[0]
      const tempFilePath = file ? file.tempFilePath : ''
      if (!tempFilePath) return
      this.setData({
        profileDraftAvatar: tempFilePath,
        profileDraftAvatarTemp: tempFilePath
      })
    } catch (error) {
      const message = error && error.errMsg ? String(error.errMsg) : ''
      if (!message.includes('cancel')) toast('选择头像失败，请稍后再试')
    }
  },

  async saveProfile() {
    const displayName = (this.data.profileDraftName || '').trim()
    const troupeName = (this.data.profileDraftTroupeName || '').trim()
    if (!displayName) {
      toast('请输入名字')
      return
    }
    this.setData({ profileSaving: true })
    try {
      let avatarUrl = this.data.profileDraftAvatar || ''
      if (this.data.profileDraftAvatarTemp) {
        if (!wx.cloud || !wx.cloud.uploadFile) {
          throw new Error('云开发未初始化')
        } else {
          try {
            const extMatch = this.data.profileDraftAvatarTemp.match(/\.([a-zA-Z0-9]+)(?:\?|$)/)
            const ext = extMatch ? extMatch[1].toLowerCase() : 'jpg'
            const upload = await wx.cloud.uploadFile({
              cloudPath: `improv/profile-avatar/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`,
              filePath: this.data.profileDraftAvatarTemp
            })
            if (!upload.fileID) throw new Error('头像上传未返回文件 ID')
            avatarUrl = upload.fileID
          } catch (uploadError) {
            console.warn('[improv-cloud] upload avatar failed', uploadError)
            throw new Error('头像上传失败，请重试')
          }
        }
      }
      const response = await updateProfile({ displayName, avatarUrl, troupeName })
      if (response.code !== 0 || !response.item) {
        toast(response.message || '保存失败，请稍后再试')
        this.setData({ profileSaving: false })
        return
      }
      const profile = normalizeProfile(response.item)
      closeModal(this, {
        profileEditVisible: false,
        profileSaving: false,
        profileDraftAvatarTemp: '',
        profileName: profile.displayName,
        profileAvatar: profile.avatarUrl,
        profileAvatarText: getAvatarText(profile.displayName),
        profileTroupeName: profile.troupeName,
        profileTags: computeProfileTags(profile.troupeName)
      })
      toast('个人卡片已更新')
    } catch (error) {
      this.setData({ profileSaving: false })
      toast('保存失败，请稍后再试')
    }
  },

  async deleteMyAccount() {
    const confirmed = await new Promise((resolve) => wx.showModal({
      title: '注销账号',
      content: '将删除你的灵感、排练、练习记录、方法卡和自定义素材，且无法恢复。',
      confirmText: '确认注销',
      confirmColor: '#D64545',
      success: (res) => resolve(res.confirm),
      fail: () => resolve(false)
    }))
    if (!confirmed) return
    try {
      await deleteAccount()
      setState({
        todayInspirations: [],
        todayRehearsals: [],
        methodCards: [],
        rehearsalHistory: [],
        practiceRecordsHistory: [],
        currentRehearsal: null,
        pausedRehearsal: null,
        currentMaterial: null,
        savedMaterialIds: [],
        playedMaterialIds: [],
        profile: null
      })
      closeModal(this, { profileEditVisible: false })
      toast('账号数据已删除')
      await this.loadAllData()
    } catch (error) {
      toast((error && error.message) || '注销失败，请重试')
    }
  },

  goRecord() {
    wx.switchTab({ url: '/pages/record/index' })
  },

  goDiscover() {
    wx.switchTab({ url: '/pages/discover/index' })
  },

  toggleTheme() {
    toggleThemeMode()
    this.setData({ themeClass: getThemeClass() })
  },

  async onDeleteInspiration(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    const confirmed = await new Promise((resolve) => {
      wx.showModal({
        title: '删除灵感',
        content: '确定删除这条灵感记录吗？',
        confirmText: '删除',
        confirmColor: '#FF6A3D',
        success: (res) => resolve(res.confirm),
        fail: () => resolve(false)
      })
    })
    if (!confirmed) return
    try {
      await deleteInspiration(id)
      const inspirations = this.data.inspirations.filter(item => item.id !== id)
      this.refreshMineView({ inspirations })
      toast('已删除')
    } catch (err) {
      toast('删除失败')
    }
  },

  onEditInspiration(e) {
    const id = (e.detail && e.detail.id) || e.currentTarget.dataset.id
    if (!id) return
    wx.navigateTo({ url: `/pages/inspiration-edit/index?id=${id}` })
  },

  async onDeleteMethodCard(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    const confirmed = await new Promise((resolve) => {
      wx.showModal({
        title: '删除方法卡',
        content: '确定删除这张方法卡吗？',
        confirmText: '删除',
        confirmColor: '#FF6A3D',
        success: (res) => resolve(res.confirm),
        fail: () => resolve(false)
      })
    })
    if (!confirmed) return
    try {
      await deleteMethodCard(id)
      const sediments = this.data.sediments.filter(item => item.id !== id)
      this.refreshMineView({ sediments })
      toast('已删除')
    } catch (err) {
      toast('删除失败')
    }
  },

  onEditMethodCard(e) {
    const id = (e.detail && e.detail.id) || e.currentTarget.dataset.id
    if (!id) return
    const card = this.data.sediments.find(item => item.id === id)
    if (!card) return
    this.setData({
      editingMethodCardId: id,
      methodCardDraftTitle: card.title || '',
      methodCardDraftContent: card.content || card.desc || card.summary || '',
      showMethodCardEditSheet: true
    })
  },

  onEditCard(e) {
    if (this.data.currentKind === 'sediments') {
      this.onEditMethodCard(e)
    } else if (this.data.currentKind === 'inspirations') {
      this.onEditInspiration(e)
    }
  },

  saveMethodCardEdit() {
    const id = this.data.editingMethodCardId
    if (!id) return
    const title = String(this.data.methodCardDraftTitle || '').trim()
    const content = String(this.data.methodCardDraftContent || '').trim()
    if (!title || !content) {
      toast('请填写完整')
      return
    }
    updateMethodCard(id, { title, desc: content }).then((result) => {
      const sediments = this.data.sediments.map(item =>
        item.id === id ? Object.assign({}, item, result.item) : item
      )
      this.setData({ showMethodCardEditSheet: false })
      this.refreshMineView({ sediments })
      toast('已保存')
    }).catch(() => {
      toast('保存失败')
    })
  },

  closeMethodCardEdit() {
    this.setData({ showMethodCardEditSheet: false })
  },

  onMethodCardDraftTitleInput(e) {
    this.setData({ methodCardDraftTitle: e.detail.value })
  },

  onMethodCardDraftContentInput(e) {
    this.setData({ methodCardDraftContent: e.detail.value })
  }
})
