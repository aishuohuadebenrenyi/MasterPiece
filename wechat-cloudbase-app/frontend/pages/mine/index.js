const { listMethodCards } = require('../../services/method-card')
const { listInspirations } = require('../../services/inspiration')
const { listRehearsals } = require('../../services/rehearsal')
const { listGameRecords } = require('../../services/game-record')
const { DEFAULT_PROFILE, getProfile, normalizeProfile, updateProfile } = require('../../services/profile')
const { getState } = require('../../store/index')
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

function buildMineViewData({ sediments = [], inspirations = [], rehearsals = [], gameRecords = [], playedCount = 0, layoutStyle = '', profile } = {}) {
  const mappedSediments = sediments.map(item => Object.assign({}, item, {
    type: item.type || (item.sourceType === 'gameRecord' ? '游戏实践' : '方法卡')
  }))
  const totalRecords = inspirations.length + getRehearsalCount(rehearsals) + mappedSediments.length + (gameRecords.length || 0)
  const methodCount = mappedSediments.length
  const rehearsalCount = getRehearsalCount(rehearsals)
  const gameRecordsCount = gameRecords.length || 0
  const showIntroState = methodCount === 0 && inspirations.length === 0 && rehearsalCount === 0 && gameRecordsCount === 0
  const nextProfile = normalizeProfile(profile || DEFAULT_PROFILE)
  return {
    sediments: mappedSediments,
    inspirations,
    rehearsals,
    gameRecords,
    totalRecords,
    playedCount,
    methodCount,
    rehearsalCount,
    gameRecordsCount,
    showIntroState,
    layoutStyle,
    profileName: nextProfile.displayName,
    profileAvatar: nextProfile.avatarUrl,
    profileAvatarText: getAvatarText(nextProfile.displayName),
    profileTroupeName: nextProfile.troupeName,
    profileTags: computeProfileTags(nextProfile.troupeName)
  }
}

Page({
  data: {
    sediments: [],
    inspirations: [],
    rehearsals: [],
    gameRecords: [],
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
    pillClass: 'orange',
    modalOpen: false,
    currentIndex: 0,
    listItems: [],
    detailItem: null,
    detailCount: '1 / 1',
    layoutStyle: '',
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
    profileSaving: false
  },

  async onShow() {
    syncTabBar(this, 2)
    const state = getState()
    const localSediments = state.methodCards || []
    const localInspirations = state.todayInspirations || []
    const localRehearsals = state.rehearsalHistory || []
    const localGameRecords = state.gameRecordsHistory || []
    this.setData(buildMineViewData({
      sediments: localSediments,
      inspirations: localInspirations,
      rehearsals: localRehearsals,
      gameRecords: localGameRecords,
      playedCount: (state.playedGameIds || []).length,
      layoutStyle: getLayoutStyle(),
      profile: state.profile || DEFAULT_PROFILE
    }))
    const [sedimentsResult, inspirationsResult, rehearsalsResult, gameRecordsResult, profileResult] = await Promise.allSettled([
      listMethodCards(),
      listInspirations(),
      listRehearsals(),
      listGameRecords(),
      getProfile()
    ])
    this.setData(buildMineViewData({
      sediments: sedimentsResult.status === 'fulfilled' ? sedimentsResult.value : localSediments,
      inspirations: inspirationsResult.status === 'fulfilled' ? inspirationsResult.value : localInspirations,
      rehearsals: rehearsalsResult.status === 'fulfilled' ? rehearsalsResult.value : localRehearsals,
      gameRecords: gameRecordsResult.status === 'fulfilled' ? gameRecordsResult.value : localGameRecords,
      playedCount: (state.playedGameIds || []).length,
      layoutStyle: getLayoutStyle(),
      profile: profileResult.status === 'fulfilled' ? profileResult.value : (state.profile || DEFAULT_PROFILE)
    }))
  },

  openList(event) {
    const kind = event.currentTarget.dataset.kind
    const listItems = kind === 'sediments' ? this.data.sediments : this.data.inspirations
    openModal(this, {
      listVisible: true,
      detailVisible: false,
      listTitle: kind === 'sediments' ? '个人沉淀' : '灵感记录',
      currentKind: kind,
      pillClass: kind === 'sediments' ? 'orange' : 'blue',
      listItems
    })
  },

  closeSheet() {
    closeModal(this, {
      listVisible: false,
      detailVisible: false,
      profileEditVisible: false,
      profileSaving: false
    })
  },

  closeDetail() {
    closeModal(this, { detailVisible: false, detailItem: null })
  },

  noop() {},

  openDetail(event) {
    const index = Number(event.currentTarget.dataset.index)
    openModal(this, {
      currentIndex: index,
      listVisible: false,
      detailVisible: true
    }, () => {
      this.syncDetail()
    })
  },

  syncDetail() {
    const items = this.data.currentKind === 'sediments' ? this.data.sediments : this.data.inspirations
    const detailItem = items[this.data.currentIndex] || items[0]
    this.setData({
      detailItem,
      detailTitle: this.data.currentKind === 'sediments' ? '沉淀详情' : '灵感详情',
      detailCount: `${this.data.currentIndex + 1} / ${items.length}`
    })
  },

  moveDetail(event) {
    const step = Number(event.currentTarget.dataset.step)
    const items = this.data.currentKind === 'sediments' ? this.data.sediments : this.data.inspirations
    const next = (this.data.currentIndex + step + items.length) % items.length
    this.setData({ currentIndex: next }, () => this.syncDetail())
  },

  prevDetail() {
    const items = this.data.currentKind === 'sediments' ? this.data.sediments : this.data.inspirations
    const next = (this.data.currentIndex - 1 + items.length) % items.length
    this.setData({ currentIndex: next }, () => this.syncDetail())
  },

  nextDetail() {
    const items = this.data.currentKind === 'sediments' ? this.data.sediments : this.data.inspirations
    const next = (this.data.currentIndex + 1) % items.length
    this.setData({ currentIndex: next }, () => this.syncDetail())
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
  }
})
