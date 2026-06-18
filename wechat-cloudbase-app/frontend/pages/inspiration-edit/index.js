const { toast } = require('../../utils/page')
const { createInspiration, updateInspiration, listInspirations } = require('../../services/inspiration')
const { createMethodCard: createMethodCardRecord } = require('../../services/method-card')
const { getLayoutStyle } = require('../../utils/layout')
const { closeModal, openModal } = require('../../utils/modal')
const {
  addInspiration,
  addMethodCard,
  getState,
  getThemeClass
} = require('../../store/index')

Page({
  data: {
    themeClass: 'theme-default',
    editingId: '',
    titleValue: '',
    contentValue: '',
    linkedGame: '',
    linkedRehearsal: '',
    arrangementValue: '带领提醒',
    selectedTags: [],
    linkVisible: false,
    insightVisible: false,
    modalOpen: false,
    linkKind: 'material',
    linkSheetTitle: '选择关联素材',
    linkOptions: [],
    linkEmptyTitle: '',
    linkEmptyDesc: '',
    showLinkSection: true,
    arrangementOptions: [],
    tagOptions: [],
    arrangementLabel: '带领提醒',
    layoutStyle: ''
  },

  onShareAppMessage() {
    return {
      title: '即兴工具箱 — 找素材·快记录·可沉淀',
      path: '/pages/discover/index',
      imageUrl: '/assets/share/share-brand.png'
    }
  },

  onShow() {
    this.setData({ themeClass: getThemeClass() })
  },
  getLinkOptions(kind) {
    const state = getState()
    if (kind === 'material') {
      return (state.materials || []).slice(0, 6).map((item) => ({
        value: item.title,
        title: item.title,
        desc: item.desc
      }))
    }
    return (state.rehearsalHistory || []).slice(0, 4).map((item) => ({
      value: item.title,
      title: item.title,
      desc: item.desc
    }))
  },
  syncOptions() {
    this.setData({
      arrangementOptions: [
        { value: '带领提醒', label: '带领提醒' },
        { value: '素材变体', label: '素材变体' },
        { value: '台词想法', label: '台词想法' },
        { value: '复盘片段', label: '复盘片段' }
      ].map((item) => Object.assign({}, item, {
        activeClass: this.data.arrangementValue === item.value ? 'active' : ''
      })),
      tagOptions: [
        { value: '关系', label: '关系' },
        { value: '新手', label: '新手' },
        { value: '节奏', label: '节奏' },
        { value: '身体', label: '身体' }
      ].map((item) => Object.assign({}, item, {
        activeClass: this.data.selectedTags.includes(item.value) ? 'active' : ''
      })),
      arrangementLabel: this.data.arrangementValue
    })
  },

  async onLoad(query) {
    this.setData({
      layoutStyle: getLayoutStyle(),
      themeClass: getThemeClass()
    })
    const editingId = (query && query.id) || ''
    if (editingId) {
      let existing = null
      const state = getState()
      existing = (state.todayInspirations || []).find((item) => item.id === editingId)
      if (!existing) {
        // store 中没有，从云端加载
        try {
          const allInspirations = await listInspirations()
          existing = allInspirations.find((item) => item.id === editingId)
        } catch (error) {
          toast('加载灵感失败')
        }
      }
      if (existing) {
        this.setData({
          editingId,
          titleValue: existing.title || existing.desc || '',
          contentValue: existing.desc || existing.content || '',
          linkedGame: existing.linkedMaterialTitle || '',
          linkedRehearsal: existing.linkedRehearsalTitle || '',
          selectedTags: existing.meta || existing.tags || []
        })
      } else {
        this.setData({ editingId })
        toast('未找到灵感记录')
      }
    }
    const state = getState()
    const rehearsalHistory = state.rehearsalHistory || []
    this.setData({
      showLinkSection: !!((state.materials || []).length || rehearsalHistory.length || this.data.linkedGame || this.data.linkedRehearsal)
    })
    this.syncOptions()
  },

  back() {
    wx.navigateBack()
  },

  updateField(event) {
    const field = event.currentTarget.dataset.field
    this.setData({ [field]: event.detail.value })
  },

  setArrangement(event) {
    const value = (event.detail && event.detail.value) || event.currentTarget.dataset.value
    this.setData({ arrangementValue: value }, () => this.syncOptions())
  },

  toggleTag(event) {
    const value = (event.detail && event.detail.value) || event.currentTarget.dataset.value
    const exists = this.data.selectedTags.includes(value)
    this.setData({
      selectedTags: exists
        ? this.data.selectedTags.filter((item) => item !== value)
        : this.data.selectedTags.concat(value)
    }, () => this.syncOptions())
  },

  openLink(event) {
    const kind = event.currentTarget.dataset.kind
    const isGame = kind === 'material'
    const linkOptions = this.getLinkOptions(kind)
    openModal(this, {
      linkVisible: true,
      linkKind: kind,
      linkSheetTitle: isGame ? '选择关联素材' : '选择关联排练',
      linkOptions,
      linkEmptyTitle: isGame ? '暂时没有可关联的素材' : '暂时没有可关联的排练',
      linkEmptyDesc: isGame
        ? '还没有素材库时，先把灵感存下来，之后再补关联也可以。'
        : '还没有排练记录时，不需要先补全结构，保存灵感更重要。'
    })
  },

  chooseLink(event) {
    const value = (event.detail && event.detail.id) || event.currentTarget.dataset.value
    closeModal(this, {
      linkVisible: false,
      linkedGame: this.data.linkKind === 'material' ? value : this.data.linkedGame,
      linkedRehearsal: this.data.linkKind === 'rehearsal' ? value : this.data.linkedRehearsal
    })
  },

  openInsight() {
    openModal(this, { insightVisible: true })
  },

  closeSheet() {
    closeModal(this, { linkVisible: false, insightVisible: false })
  },

  async save() {
    const editingId = this.data.editingId
    const payload = {
      title: this.data.titleValue,
      desc: this.data.contentValue,
      meta: this.data.selectedTags,
      linkedMaterialTitle: this.data.linkedGame,
      linkedRehearsalTitle: this.data.linkedRehearsal
    }
    if (editingId) {
      try {
        await updateInspiration(editingId, payload)
        toast('已更新灵感')
      } catch (error) {
        toast('保存失败，请重试')
        return
      }
    } else {
      const item = {
        id: `inspiration-${Date.now()}`,
        type: '灵感',
        title: this.data.titleValue,
        desc: this.data.contentValue,
        meta: this.data.selectedTags,
        linkedMaterialTitle: this.data.linkedGame,
        linkedRehearsalTitle: this.data.linkedRehearsal
      }
      try {
        await createInspiration(payload)
        addInspiration(item)
        toast('已保存灵感')
      } catch (error) {
        addInspiration(Object.assign({}, item, { syncStatus: 'pending' }))
        toast('已本地保存，待同步')
      }
    }
    wx.navigateBack()
  },
  async createMethodCard() {
    this.closeSheet()
    const item = {
      id: `method-${Date.now()}`,
      type: this.data.arrangementValue,
      title: this.data.titleValue || '未命名方法卡',
      desc: this.data.contentValue || '待补充',
      meta: (this.data.selectedTags.length ? this.data.selectedTags : []).concat('可复用')
    }
    try {
      await createMethodCardRecord({
        sourceType: 'inspiration',
        title: item.title,
        desc: item.desc,
        meta: item.meta
      })
      addMethodCard(item)
      toast('已沉淀为方法卡')
    } catch (error) {
      addMethodCard(Object.assign({}, item, { syncStatus: 'pending' }))
      toast('已本地保存，待同步')
    }
  }
})
