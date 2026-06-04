const { games } = require('../../services/mock-data')
const { listGames } = require('../../services/game')
const { nextGameStatus, updateGameStatus } = require('../../services/rehearsal')
const { addTodayItem, writeLocalState } = require('../../services/local-state')
const { toast } = require('../../utils/page')

Page({
  data: {
    games,
    plan: ['name-chain', 'space-walk', 'status-swap'],
    statuses: {
      'name-chain': '已完成',
      'space-walk': '进行中',
      'status-swap': '未开始'
    },
    addVisible: false,
    planVisible: false,
    query: ''
  },

  getPlanGames() {
    return this.data.plan.map((id) => {
      const game = this.data.games.find((item) => item.id === id)
      if (!game) return null
      return Object.assign({}, game, {
        status: this.data.statuses[id] || '未开始',
        metaText: game.meta[1],
        tagText: game.tags[0],
        keepValue: id === 'name-chain' ? '开场很快进入状态' : '',
        tryValue: id === 'space-walk' ? '口令少一点' : ''
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
    this.setData({
      planGames: this.getPlanGames(),
      filteredGames: this.getFilteredGames()
    })
  },

  async onLoad() {
    this.syncPlan()
    try {
      const cloudGames = await listGames()
      this.setData({ games: cloudGames.length ? cloudGames : games }, () => this.syncPlan())
    } catch (error) {
      this.syncPlan()
    }
  },

  back() {
    wx.navigateBack()
  },

  openAdd() {
    this.setData({ addVisible: true })
  },

  openPlan() {
    this.setData({ planVisible: true })
  },

  closeSheet() {
    this.setData({ addVisible: false, planVisible: false })
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
    if (!this.data.plan.includes(id)) {
      this.setData({
        plan: this.data.plan.concat(id),
        [`statuses.${id}`]: '未开始'
      }, () => this.syncPlan())
    }
    this.closeSheet()
    toast('已加入排练')
  },

  async toggleStatus(event) {
    const id = event.currentTarget.dataset.id
    const next = nextGameStatus(this.data.statuses[id] || '未开始')
    this.setData({ [`statuses.${id}`]: next }, () => this.syncPlan())
    await updateGameStatus({
      rehearsalId: 'today-rehearsal',
      gameId: id,
      status: next
    })
    toast(`已标记为${next}`)
  },

  openGame(event) {
    wx.navigateTo({ url: `/pages/game-detail/index?id=${event.currentTarget.dataset.id}` })
  },

  pause() {
    const pausedRehearsal = {
      id: 'today-rehearsal',
      title: '开心即兴团 · 90 分钟',
      desc: '身体到场 → 关系建立 → 小复盘',
      status: '暂停中'
    }
    writeLocalState({ pausedRehearsal })
    addTodayItem('todayRehearsals', pausedRehearsal)
    toast('排练已暂停')
    wx.switchTab({ url: '/pages/record/index' })
  },

  review() {
    wx.navigateTo({ url: '/pages/rehearsal-review/index' })
  }
})
