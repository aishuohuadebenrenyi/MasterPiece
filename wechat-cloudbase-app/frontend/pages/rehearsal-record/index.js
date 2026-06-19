const { listMaterials } = require('../../services/material')
const { nextMaterialStatus, updateMaterialStatus, updateRehearsal } = require('../../services/rehearsal')
const {
  addMaterialToCurrentRehearsal,
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
    materials: [],
    rehearsalId: '',
    title: '',
    duration: '',
    desc: '',
    metaText: '',
    planMaterials: [],
    filteredMaterials: [],
    linkedInspirations: [],
    addVisible: false,
    planVisible: false,
    modalOpen: false,
    query: '',
    addEmptyTitle: '',
    addEmptyDesc: '',
    layoutStyle: ''
  },

  onShareAppMessage() {
    const state = getState()
    const current = state.currentRehearsal
    return {
      title: current ? `排练进行中 — ${current.title}` : '排练进行中 — 即兴工具箱',
      path: '/pages/discover/index',
      imageUrl: '/assets/share/share-rehearsal.png'
    }
  },

  onShow() {
    this.setData({ themeClass: getThemeClass() })
  },
  unsubscribeStore: null,

  getPlanMaterials() {
    const rehearsal = getState().currentRehearsal
    const plan = rehearsal && rehearsal.plan && rehearsal.plan.length
      ? rehearsal.plan.map((item) => item.materialId)
      : []
    return plan.map((id) => {
      const material = this.data.materials.find((item) => item.id === id)
      if (!material) return null
      const planItem = rehearsal && rehearsal.plan ? rehearsal.plan.find((item) => item.materialId === id) : null
      return Object.assign({}, material, {
        status: planItem ? planItem.status : '未开始',
        metaText: material.meta[1],
        tagText: material.tags[0],
        keepValue: planItem ? planItem.keep : '',
        tryValue: planItem ? planItem.try : ''
      })
    }).filter(Boolean)
  },

  getFilteredMaterials() {
    const query = this.data.query.trim().toLowerCase()
    const plannedIds = new Set(((getState().currentRehearsal && getState().currentRehearsal.plan) || []).map((item) => item.materialId))
    return this.data.materials.filter((material) => {
      if (plannedIds.has(material.id)) return false
      if (material.referenceOnly) return false
      const text = `${material.title} ${material.desc} ${material.type || ''} ${material.tags.join(' ')} ${(material.abilities || []).join(' ')} ${material.meta.join(' ')}`.toLowerCase()
      return !query || text.includes(query)
    })
  },

  syncPlan() {
    const state = getState()
    const rehearsal = state.currentRehearsal
    const linkedInspirations = rehearsal ? state.todayInspirations.filter(i => i.linkedRehearsalId === rehearsal.id) : []
    
    const planMaterials = this.getPlanMaterials()
    const filteredMaterials = this.getFilteredMaterials()
    const hasMaterialLibrary = this.data.materials.length > 0
    const availableMaterialsCount = hasMaterialLibrary
      ? this.data.materials.filter((material) => !planMaterials.some((item) => item.id === material.id)).length
      : 0
    const hasQuery = !!this.data.query.trim()
    this.setData({
      rehearsalId: rehearsal ? rehearsal.id : '',
      title: rehearsal ? rehearsal.teamName : '',
      duration: rehearsal ? rehearsal.duration : '',
      desc: rehearsal ? rehearsal.desc : '',
      metaText: rehearsal ? `${rehearsal.plan.length} 条素材 · ${rehearsal.status}` : '',
      planMaterials,
      filteredMaterials,
      addEmptyTitle: availableMaterialsCount === 0
        ? '可加入的素材都已经在计划里了'
        : hasMaterialLibrary
        ? (hasQuery ? '没有找到匹配的素材' : '暂时没有可加入的素材')
        : '还没有可加入的素材',
      addEmptyDesc: availableMaterialsCount === 0
        ? '如果还想加新内容，先去发现页补充几个素材，再回来安排这次排练。'
        : hasMaterialLibrary
        ? (hasQuery ? '换个关键词试试，或清空搜索继续浏览。' : '去发现页添加常用素材后，再回来安排这次排练。')
        : '先去发现页添加几个常用素材，再来安排这次排练。',
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
      const cloudMaterials = await listMaterials()
      this.setData({ materials: cloudMaterials }, () => this.syncPlan())
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

  searchMaterial(event) {
    this.setData({ query: event.detail.value }, () => this.syncPlan())
  },

  addMaterial(event) {
    const id = (event.detail && event.detail.id) || event.currentTarget.dataset.id
    if (this.data.planMaterials.some((item) => item.id === id)) {
      toast('这条素材已经在排练计划里')
      return
    }
    const next = addMaterialToCurrentRehearsal(id)
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
    const target = this.data.planMaterials.find((item) => item.id === id)
    const next = nextMaterialStatus(target ? target.status : '未开始')
    updateCurrentRehearsalPlan(id, {
      status: next,
      keep: target ? target.keepValue : '',
      try: target ? target.tryValue : ''
    })
    await updateMaterialStatus({
      rehearsalId: this.data.rehearsalId,
      materialId: id,
      status: next
    })
    toast(`已标记为${next}`)
  },

  updatePlanField(event) {
    const materialId = event.currentTarget.dataset.id
    const field = event.currentTarget.dataset.field
    updateCurrentRehearsalPlan(materialId, {
      [field]: event.detail.value
    })
  },

  openMaterial(event) {
    wx.navigateTo({ url: `/pages/material-detail/index?id=${event.currentTarget.dataset.id}` })
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
