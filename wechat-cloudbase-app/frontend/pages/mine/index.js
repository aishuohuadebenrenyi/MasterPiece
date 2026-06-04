const { methodCards, inspirations } = require('../../services/mock-data')
const { listMethodCards } = require('../../services/method-card')
const { listInspirations } = require('../../services/inspiration')
const { readLocalState } = require('../../services/local-state')
const { setTabBarHidden, syncTabBar } = require('../../utils/tabbar')

Page({
  data: {
    sediments: methodCards,
    inspirations,
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
    detailCount: '1 / 1'
  },

  async onShow() {
    syncTabBar(this, 2)
    const localState = readLocalState()
    this.setData({
      sediments: (localState.methodCards || []).concat(methodCards),
      inspirations: (localState.todayInspirations || []).concat(inspirations)
    })
    try {
      const results = await Promise.all([listMethodCards(), listInspirations()])
      const cloudSediments = results[0]
      const cloudInspirations = results[1]
      this.setData({
        sediments: (localState.methodCards || []).concat(cloudSediments.length ? cloudSediments : methodCards),
        inspirations: (cloudInspirations.length ? cloudInspirations : this.data.inspirations)
      })
    } catch (error) {
      this.setData({
        sediments: (localState.methodCards || []).concat(methodCards),
        inspirations: (localState.todayInspirations || []).concat(inspirations)
      })
    }
  },

  openList(event) {
    const kind = event.currentTarget.dataset.kind
    const listItems = kind === 'sediments' ? this.data.sediments : this.data.inspirations
    this.setData({
      listVisible: true,
      detailVisible: false,
      modalOpen: true,
      listTitle: kind === 'sediments' ? '个人沉淀' : '灵感记录',
      currentKind: kind,
      pillClass: kind === 'sediments' ? 'orange' : 'blue',
      listItems
    }, () => setTabBarHidden(this, true))
  },

  closeSheet() {
    this.setData({ listVisible: false, detailVisible: false, modalOpen: false }, () => setTabBarHidden(this, false))
  },

  openDetail(event) {
    const index = Number(event.currentTarget.dataset.index)
    this.setData({
      currentIndex: index,
      listVisible: false,
      detailVisible: true,
      modalOpen: true
    }, () => {
      setTabBarHidden(this, true)
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
  }
})
