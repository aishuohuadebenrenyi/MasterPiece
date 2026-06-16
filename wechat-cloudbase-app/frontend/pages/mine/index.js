const { createMethodCard, listMethodCards } = require('../../services/method-card')
const { listInspirations } = require('../../services/inspiration')
const { listRehearsals } = require('../../services/rehearsal')
const { listPracticeRecords } = require('../../services/practice-record')
const { DEFAULT_PROFILE, getProfile, normalizeProfile, updateProfile } = require('../../services/profile')
const { addMethodCard, getState, getThemeClass, setDismissedPendingKeys, toggleThemeMode } = require('../../store/index')
const { closeModal, openModal } = require('../../utils/modal')
const { syncTabBar } = require('../../utils/tabbar')
const { getLayoutStyle } = require('../../utils/layout')
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
  if (sourceType === 'gameRecord' || sourceType === 'practiceRecord') return 'practiceRecord'
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

function buildPendingItems({ inspirations = [], rehearsals = [], gameRecords = [], sediments = [] } = {}) {
  const existing = new Set(sediments.map(getSourceKey))
  const candidates = []
    .concat(inspirations.map((item) => normalizePendingItem(item, 'inspiration')))
    .concat(gameRecords.map((item) => normalizePendingItem(item, 'practiceRecord')))
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

function normalizeDetailIndex(index, items = []) {
  if (!Array.isArray(items) || !items.length) return 0
  const numericIndex = Number(index)
  if (!Number.isFinite(numericIndex)) return 0
  if (numericIndex < 0) return 0
  if (numericIndex >= items.length) return items.length - 1
  return numericIndex
}

function buildMineViewData({ sediments = [], inspirations = [], rehearsals = [], gameRecords = [], playedCount = 0, layoutStyle = '', profile, methodFilter = 'all', discardedPendingKeys = [] } = {}) {
  const mappedSediments = sediments.map(item => Object.assign({}, item, {
    sourceType: normalizeMethodSourceType(item.sourceType),
    type: item.type || getSourceLabel(item.sourceType),
    filteredMeta: filterItemMeta(Object.assign({}, item, {
      type: item.type || getSourceLabel(item.sourceType)
    }))
  }))
  const mappedInspirations = inspirations.map((item) => Object.assign({}, item, {
    sourceType: item.sourceType || 'inspiration',
    type: item.type || '灵感',
    filteredMeta: filterItemMeta(Object.assign({}, item, {
      type: item.type || '灵感'
    }))
  }))
  const discarded = new Set(discardedPendingKeys)
  const pendingItems = buildPendingItems({ inspirations: mappedInspirations, rehearsals, gameRecords, sediments: mappedSediments })
    .filter((item) => !discarded.has(getSourceKey(item)))
  const totalRecords = mappedInspirations.length + getRehearsalCount(rehearsals) + mappedSediments.length + (gameRecords.length || 0)
  const methodCount = mappedSediments.length
  const rehearsalCount = getRehearsalCount(rehearsals)
  const gameRecordsCount = gameRecords.length || 0
  const showIntroState = methodCount === 0 && mappedInspirations.length === 0 && rehearsalCount === 0 && gameRecordsCount === 0
  const showPendingCard = pendingItems.length > 0
  const showSedimentsCard = methodCount > 0
  const showInspirationsCard = mappedInspirations.length > 0
  const showGameRecordsCard = gameRecordsCount > 0
  const showRehearsalCard = rehearsalCount > 0
  const visibleAssetCardCount = [showSedimentsCard, showInspirationsCard, showGameRecordsCard, showRehearsalCard].filter(Boolean).length
  const showStatsCard = !showIntroState && (totalRecords > 1 || playedCount > 0 || methodCount > 0)
  const showLiteGuideCard = !showIntroState && visibleAssetCardCount <= 1
  const nextProfile = normalizeProfile(profile || DEFAULT_PROFILE)
  return {
    sediments: mappedSediments,
    inspirations: mappedInspirations,
    rehearsals,
    gameRecords,
    pendingItems,
    pendingCount: pendingItems.length,
    totalRecords,
    playedCount,
    methodCount,
    rehearsalCount,
    gameRecordsCount,
    showIntroState,
    showPendingCard,
    showSedimentsCard,
    showInspirationsCard,
    showGameRecordsCard,
    showRehearsalCard,
    showStatsCard,
    showLiteGuideCard,
    layoutStyle,
    profileName: nextProfile.displayName,
    profileAvatar: nextProfile.avatarUrl,
    profileAvatarText: getAvatarText(nextProfile.displayName),
    profileTroupeName: nextProfile.troupeName,
    profileTags: computeProfileTags(nextProfile.troupeName),
    methodFilterOptions: buildMethodFilterOptions(mappedSediments, methodFilter)
  }
}

Page({
  data: {
    sediments: [],
    inspirations: [],
    rehearsals: [],
    gameRecords: [],
    pendingItems: [],
    pendingCount: 0,
    discardedPendingKeys: [],
    totalRecords: 0,
    playedCount: 0,
    methodCount: 0,
    rehearsalCount: 0,
    gameRecordsCount: 0,
    listVisible: false,
    detailVisible: false,
    listTitle: '',
    detailTitle: '',
    currentKind: 'sediments',
    methodFilter: 'all',
    methodFilterOptions: [],
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
    showGameRecordsCard: false,
    showRehearsalCard: false,
    showStatsCard: false,
    showLiteGuideCard: false
  },

  onLoad() {
    this.setData({
      layoutStyle: getLayoutStyle(),
      themeClass: getThemeClass()
    })
  },

  async onShow() {
    syncTabBar(this, 2)
    const state = getState()
    const localSediments = state.methodCards || []
    const localInspirations = state.todayInspirations || []
    const localRehearsals = state.rehearsalHistory || []
    const localGameRecords = state.practiceRecordsHistory || []
    this.setData(Object.assign({}, buildMineViewData({
      sediments: localSediments,
      inspirations: localInspirations,
      rehearsals: localRehearsals,
      gameRecords: localGameRecords,
      playedCount: (state.playedMaterialIds || []).length,
      layoutStyle: getLayoutStyle(),
      profile: state.profile || DEFAULT_PROFILE,
      methodFilter: this.data.methodFilter,
      discardedPendingKeys: state.dismissedPendingKeys || this.data.discardedPendingKeys
    }), {
      themeClass: getThemeClass()
    }))
    const [sedimentsResult, inspirationsResult, rehearsalsResult, gameRecordsResult, profileResult] = await Promise.allSettled([
      listMethodCards(),
      listInspirations(),
      listRehearsals(),
      listPracticeRecords(),
      getProfile()
    ])
    this.setData(buildMineViewData({
      sediments: sedimentsResult.status === 'fulfilled' ? sedimentsResult.value : localSediments,
      inspirations: inspirationsResult.status === 'fulfilled' ? inspirationsResult.value : localInspirations,
      rehearsals: rehearsalsResult.status === 'fulfilled' ? rehearsalsResult.value : localRehearsals,
      gameRecords: gameRecordsResult.status === 'fulfilled' ? gameRecordsResult.value : localGameRecords,
      playedCount: (state.playedMaterialIds || []).length,
      layoutStyle: getLayoutStyle(),
      profile: profileResult.status === 'fulfilled' ? profileResult.value : (state.profile || DEFAULT_PROFILE),
      methodFilter: this.data.methodFilter,
      discardedPendingKeys: getState().dismissedPendingKeys || this.data.discardedPendingKeys
    }))
  },

  refreshMineView(overrides = {}, callback) {
    const hasOwn = (key) => Object.prototype.hasOwnProperty.call(overrides, key)
    const nextSediments = hasOwn('sediments') ? overrides.sediments : this.data.sediments
    const nextInspirations = hasOwn('inspirations') ? overrides.inspirations : this.data.inspirations
    const nextRehearsals = hasOwn('rehearsals') ? overrides.rehearsals : this.data.rehearsals
    const nextGameRecords = hasOwn('gameRecords') ? overrides.gameRecords : this.data.gameRecords
    const nextMethodFilter = hasOwn('methodFilter') ? overrides.methodFilter : this.data.methodFilter
    const nextDiscardedPendingKeys = hasOwn('discardedPendingKeys') ? overrides.discardedPendingKeys : this.data.discardedPendingKeys
    const nextProfile = {
      displayName: hasOwn('profileName') ? overrides.profileName : this.data.profileName,
      avatarUrl: hasOwn('profileAvatar') ? overrides.profileAvatar : this.data.profileAvatar,
      troupeName: hasOwn('profileTroupeName') ? overrides.profileTroupeName : this.data.profileTroupeName
    }
    const nextViewData = buildMineViewData({
      sediments: nextSediments,
      inspirations: nextInspirations,
      rehearsals: nextRehearsals,
      gameRecords: nextGameRecords,
      playedCount: this.data.playedCount,
      layoutStyle: this.data.layoutStyle,
      profile: nextProfile,
      methodFilter: nextMethodFilter,
      discardedPendingKeys: nextDiscardedPendingKeys
    })
    const nextListItems = this.data.currentKind === 'sediments'
      ? filterSediments(nextViewData.sediments, nextMethodFilter)
      : this.data.currentKind === 'pending'
        ? nextViewData.pendingItems
        : nextViewData.inspirations
    this.setData(Object.assign({}, nextViewData, overrides, {
      listItems: nextListItems
    }), callback)
  },

  openList(event) {
    const kind = event.currentTarget.dataset.kind
    const listItems = kind === 'sediments'
      ? filterSediments(this.data.sediments, this.data.methodFilter)
      : kind === 'pending'
        ? this.data.pendingItems
        : this.data.inspirations
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
    const items = this.data.currentKind === 'sediments'
      ? filterSediments(this.data.sediments, this.data.methodFilter)
      : this.data.currentKind === 'pending'
        ? this.data.pendingItems
        : this.data.inspirations
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
    const items = this.data.currentKind === 'sediments'
      ? filterSediments(this.data.sediments, this.data.methodFilter)
      : this.data.currentKind === 'pending'
        ? this.data.pendingItems
        : this.data.inspirations
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
    const items = this.data.currentKind === 'sediments'
      ? filterSediments(this.data.sediments, this.data.methodFilter)
      : this.data.currentKind === 'pending'
        ? this.data.pendingItems
        : this.data.inspirations
    if (!items.length) return
    const currentIndex = normalizeDetailIndex(this.data.currentIndex, items)
    const next = (currentIndex + step + items.length) % items.length
    this.setData({ currentIndex: next }, () => this.syncDetail())
  },

  prevDetail() {
    const items = this.data.currentKind === 'sediments'
      ? filterSediments(this.data.sediments, this.data.methodFilter)
      : this.data.currentKind === 'pending'
        ? this.data.pendingItems
        : this.data.inspirations
    if (!items.length) return
    const currentIndex = normalizeDetailIndex(this.data.currentIndex, items)
    const next = (currentIndex - 1 + items.length) % items.length
    this.setData({ currentIndex: next }, () => this.syncDetail())
  },

  nextDetail() {
    const items = this.data.currentKind === 'sediments'
      ? filterSediments(this.data.sediments, this.data.methodFilter)
      : this.data.currentKind === 'pending'
        ? this.data.pendingItems
        : this.data.inspirations
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
      await createMethodCard({
        sourceType: item.sourceType,
        sourceId: item.sourceId,
        sourceTitle: item.sourceTitle,
        type: item.type,
        title: item.title,
        desc: item.desc,
        meta: item.meta
      })
      addMethodCard(item)
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
      const pendingItem = Object.assign({}, item, { syncStatus: 'pending' })
      addMethodCard(pendingItem)
      const sourceKey = getSourceKey(source)
      const sediments = [pendingItem].concat(this.data.sediments)
      const discardedPendingKeys = Array.from(new Set((this.data.discardedPendingKeys || []).concat(sourceKey)))
      setDismissedPendingKeys(discardedPendingKeys)
      this.refreshMineView({
        sediments,
        discardedPendingKeys,
        sedimentSaving: false
      })
      this.closeDetail()
      toast('已本地保存，待同步')
    }
  },

  openTeamRecords() {
    wx.navigateTo({ url: '/pages/team-records/index' })
  },

  openGameRecords() {
    wx.navigateTo({ url: '/pages/game-records/index' })
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
          // 云开发未初始化时，降级使用本地临时路径
          avatarUrl = this.data.profileDraftAvatarTemp
        } else {
          try {
            const extMatch = this.data.profileDraftAvatarTemp.match(/\.([a-zA-Z0-9]+)(?:\?|$)/)
            const ext = extMatch ? extMatch[1].toLowerCase() : 'jpg'
            const upload = await wx.cloud.uploadFile({
              cloudPath: `improv/profile-avatar/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`,
              filePath: this.data.profileDraftAvatarTemp
            })
            avatarUrl = upload.fileID || this.data.profileDraftAvatarTemp
          } catch (uploadError) {
            console.warn('[improv-cloud] upload avatar failed, fallback to local temp path', uploadError)
            avatarUrl = this.data.profileDraftAvatarTemp
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

  goRecord() {
    wx.switchTab({ url: '/pages/record/index' })
  },

  goDiscover() {
    wx.switchTab({ url: '/pages/discover/index' })
  },

  toggleTheme() {
    toggleThemeMode()
    this.setData({ themeClass: getThemeClass() })
  }
})
