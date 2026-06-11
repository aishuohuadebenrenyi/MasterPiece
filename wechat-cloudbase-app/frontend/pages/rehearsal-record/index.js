const { listGames } = require('../../services/game')
const { nextGameStatus, updateGameStatus, updateRehearsal } = require('../../services/rehearsal')
const {
  addGameToCurrentRehearsal,
  getState,
  getThemeClass,
  patchCurrentRehearsal,
  setCurrentRehearsal,
  subscribe,
  updateCurrentRehearsalPlan,
  upsertRehearsalHistory
} = require('../../store/index')
const { toast } = require('../../utils/page')
const { getLayoutStyle } = require('../../utils/layout')
const { closeModal, openModal } = require('../../utils/modal')

Page({
  data: {
    themeClass: 'theme-default',
    games: [],
    rehearsalId: '',
    title: '',
    duration: '',
    desc: '',
    metaText: '',
    planGames: [],
    filteredGames: [],
    linkedInspirations: [],
    addVisible: false,
    planVisible: false,
    modalOpen: false,
    query: '',
    addEmptyTitle: '',
    addEmptyDesc: '',
    layoutStyle: ''
  },

  onShow() {
    this.setData({ themeClass: getThemeClass() })
  },
  unsubscribeStore: null,

  getPlanGames() {
    const rehearsal = getState().currentRehearsal
    const plan = rehearsal && rehearsal.plan && rehearsal.plan.length
      ? rehearsal.plan.map((item) => item.gameId)
      : []
    return plan.map((id) => {
      const game = this.data.games.find((item) => item.id === id)
      if (!game) return null
      const planItem = rehearsal && rehearsal.plan ? rehearsal.plan.find((item) => item.gameId === id) : null
      return Object.assign({}, game, {
        status: planItem ? planItem.status : '未开始',
        metaText: game.meta[1],
        tagText: game.tags[0],
        keepValue: planItem ? planItem.keep : '',
        tryValue: planItem ? planItem.try : ''
      })
    }).filter(Boolean)
  },

  getFilteredGames() {
    const query = this.data.query.trim().toLowerCase()
    const plannedIds = new Set(((getState().currentRehearsal && getState().currentRehearsal.plan) || []).map((item) => item.gameId))
    return this.data.games.filter((game) => {
      if (plannedIds.has(game.id)) return false
      const text = `${game.title} ${game.desc} ${game.tags.join(' ')} ${game.meta.join(' ')}`.toLowerCase()
      return !query || text.includes(query)
    })
  },

  syncPlan() {
    const state = getState()
    const rehearsal = state.currentRehearsal
    const linkedInspirations = rehearsal ? state.todayInspirations.filter(i => i.linkedRehearsalId === rehearsal.id) : []
    
    const planGames = this.getPlanGames()
    const filteredGames = this.getFilteredGames()
    const hasGameLibrary = this.data.games.length > 0
    const availableGamesCount = hasGameLibrary
      ? this.data.games.filter((game) => !planGames.some((item) => item.id === game.id)).length
      : 0
    const hasQuery = !!this.data.query.trim()
    this.setData({
      rehearsalId: rehearsal ? rehearsal.id : '',
      title: rehearsal ? rehearsal.teamName : '',
      duration: rehearsal ? rehearsal.duration : '',
      desc: rehearsal ? rehearsal.desc : '',
      metaText: rehearsal ? `${rehearsal.plan.length} 个游戏 · ${rehearsal.status}` : '',
      planGames,
      filteredGames,
      addEmptyTitle: availableGamesCount === 0
        ? '可加入的游戏都已经在计划里了'
        : hasGameLibrary
        ? (hasQuery ? '没有找到匹配的游戏' : '暂时没有可加入的游戏')
        : '还没有可加入的游戏',
      addEmptyDesc: availableGamesCount === 0
        ? '如果还想加新内容，先去发现页补充几个游戏，再回来安排这次排练。'
        : hasGameLibrary
        ? (hasQuery ? '换个关键词试试，或清空搜索继续浏览。' : '去发现页添加常用游戏后，再回来安排这次排练。')
        : '先去发现页添加几个常用游戏，再来安排这次排练。',
      linkedInspirations
    })
  },

  async onLoad(options = {}) {
    this.setData({
      layoutStyle: getLayoutStyle(),
      themeClass: getThemeClass()
    })
    const state = getState()
    const routeId = options.id
    if (routeId && state.rehearsalHistory) {
      const matched = state.rehearsalHistory.find((item) => item.id === routeId)
      if (matched) setCurrentRehearsal(matched)
    }
    this.unsubscribeStore = subscribe(() => this.syncPlan())
    this.syncPlan()
    try {
      const cloudGames = await listGames()
      this.setData({ games: cloudGames }, () => this.syncPlan())
    } catch (error) {
      this.syncPlan()
    }
  },

  onUnload() {
    if (this.unsubscribeStore) this.unsubscribeStore()
  },

  back() {
    wx.navigateBack()
  },

  openAdd() {
    openModal(this, { addVisible: true, planVisible: false })
  },

  openPlan() {
    openModal(this, { planVisible: true, addVisible: false })
  },

  closeSheet() {
    closeModal(this, {
      addVisible: false,
      planVisible: false,
      query: ''
    }, () => this.syncPlan())
  },

  savePlan() {
    this.closeSheet()
    toast('排练计划已更新')
  },

  searchGame(event) {
    this.setData({ query: event.detail.value }, () => this.syncPlan())
  },

  addGame(event) {
    const id = (event.detail && event.detail.id) || event.currentTarget.dataset.id
    if (this.data.planGames.some((item) => item.id === id)) {
      toast('这个游戏已经在排练计划里')
      return
    }
    const next = addGameToCurrentRehearsal(id)
    if (!next) {
      toast('当前没有进行中的排练')
      return
    }
    this.closeSheet()
    toast('已加入排练')
  },

  clearAddSearch() {
    this.setData({ query: '' }, () => this.syncPlan())
  },

  goDiscover() {
    closeModal(this, { addVisible: false, planVisible: false, query: '' }, () => {
      wx.switchTab({ url: '/pages/discover/index' })
    })
  },

  async toggleStatus(event) {
    const id = (event.detail && event.detail.id) || event.currentTarget.dataset.id
    const target = this.data.planGames.find((item) => item.id === id)
    const next = nextGameStatus(target ? target.status : '未开始')
    updateCurrentRehearsalPlan(id, {
      status: next,
      keep: target ? target.keepValue : '',
      try: target ? target.tryValue : ''
    })
    await updateGameStatus({
      rehearsalId: this.data.rehearsalId,
      gameId: id,
      status: next
    })
    toast(`已标记为${next}`)
  },

  updatePlanField(event) {
    const gameId = event.currentTarget.dataset.id
    const field = event.currentTarget.dataset.field
    updateCurrentRehearsalPlan(gameId, {
      [field]: event.detail.value
    })
  },

  openGame(event) {
    wx.navigateTo({ url: `/pages/game-detail/index?id=${event.currentTarget.dataset.id}` })
  },

  pause() {
    const current = patchCurrentRehearsal({
      status: '暂停中',
      title: `${this.data.title} · ${this.data.duration} 分钟`
    })
    if (current) {
      upsertRehearsalHistory(current)
      updateRehearsal(current.id, {
        status: '暂停中',
        plan: current.plan
      }).catch(() => {})
    }
    toast('排练已暂停')
    wx.switchTab({ url: '/pages/record/index' })
  },

  review() {
    wx.navigateTo({ url: '/pages/rehearsal-review/index' })
  }
})
