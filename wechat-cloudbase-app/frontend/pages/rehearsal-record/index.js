const { listGames } = require('../../services/game')
const { nextGameStatus, updateGameStatus, updateRehearsal } = require('../../services/rehearsal')
const {
  addGameToCurrentRehearsal,
  getState,
  patchCurrentRehearsal,
  setCurrentRehearsal,
  startRehearsal,
  subscribe,
  updateCurrentRehearsalPlan,
  upsertRehearsalHistory
} = require('../../store/index')
const { toast } = require('../../utils/page')
const { getLayoutStyle } = require('../../utils/layout')
const { closeModal, openModal } = require('../../utils/modal')

Page({
  data: {
    games: [],
    rehearsalId: '',
    title: '',
    duration: '',
    desc: '',
    metaText: '',
    planGames: [],
    linkedInspirations: [],
    addVisible: false,
    planVisible: false,
    modalOpen: false,
    query: '',
    layoutStyle: ''
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
    return this.data.games.filter((game) => {
      const text = `${game.title} ${game.desc} ${game.tags.join(' ')} ${game.meta.join(' ')}`.toLowerCase()
      return !query || text.includes(query)
    })
  },

  syncPlan() {
    const state = getState()
    const rehearsal = state.currentRehearsal
    const linkedInspirations = rehearsal ? state.todayInspirations.filter(i => i.linkedRehearsalId === rehearsal.id) : []
    
    this.setData({
      rehearsalId: rehearsal ? rehearsal.id : '',
      title: rehearsal ? rehearsal.teamName : '',
      duration: rehearsal ? rehearsal.duration : '',
      desc: rehearsal ? rehearsal.desc : '',
      metaText: rehearsal ? `${rehearsal.plan.length} 个游戏 · ${rehearsal.status}` : '',
      planGames: this.getPlanGames(),
      filteredGames: this.getFilteredGames(),
      linkedInspirations
    })
  },

  async onLoad(options = {}) {
    this.setData({ layoutStyle: getLayoutStyle() })
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
    openModal(this, { addVisible: true })
  },

  openPlan() {
    openModal(this, { planVisible: true })
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
    const id = event.currentTarget.dataset.id
    addGameToCurrentRehearsal(id)
    this.closeSheet()
    toast('已加入排练')
  },

  async toggleStatus(event) {
    const id = event.currentTarget.dataset.id
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
