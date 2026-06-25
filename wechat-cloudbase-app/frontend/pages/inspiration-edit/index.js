const { toast } = require('../../utils/page')
const { updateInspiration, listInspirations } = require('../../services/inspiration')
const { getLayoutStyle } = require('../../utils/layout')
const { closeModal, openModal } = require('../../utils/modal')
const {
  getState,
  getThemeClass,
  upsertInspiration
} = require('../../store/index')

Page({
  data: {
    themeClass: 'theme-default',
    editingId: '',
    titleValue: '',
    contentValue: '',
    linkedMaterial: '',
    linkedMaterialId: '',
    linkedRehearsal: '',
    linkedRehearsalId: '',
    selectedTags: [],
    linkVisible: false,
    modalOpen: false,
    linkKind: 'material',
    linkSheetTitle: '选择关联素材',
    linkOptions: [],
    linkEmptyTitle: '',
    linkEmptyDesc: '',
    showLinkSection: true,
    tagOptions: [],
    saving: false,
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
        value: item.id,
        title: item.title,
        desc: item.desc
      }))
    }
    return (state.rehearsalHistory || []).slice(0, 4).map((item) => ({
      value: item.id,
      title: item.title,
      desc: item.desc
    }))
  },
  syncOptions() {
    this.setData({
      tagOptions: [
        { value: '关系', label: '关系' },
        { value: '新手', label: '新手' },
        { value: '节奏', label: '节奏' },
        { value: '身体', label: '身体' }
      ].map((item) => Object.assign({}, item, {
        activeClass: this.data.selectedTags.includes(item.value) ? 'active' : ''
      }))
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
          linkedMaterial: existing.linkedMaterialTitle || '',
          linkedMaterialId: existing.linkedMaterialId || '',
          linkedRehearsal: existing.linkedRehearsalTitle || '',
          linkedRehearsalId: existing.linkedRehearsalId || '',
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
      showLinkSection: !!((state.materials || []).length || rehearsalHistory.length || this.data.linkedMaterial || this.data.linkedRehearsal)
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
    const isMaterial = kind === 'material'
    const linkOptions = this.getLinkOptions(kind)
    openModal(this, {
      linkVisible: true,
      linkKind: kind,
      linkSheetTitle: isMaterial ? '选择关联素材' : '选择关联排练',
      linkOptions,
      linkEmptyTitle: isMaterial ? '暂时没有可关联的素材' : '暂时没有可关联的排练',
      linkEmptyDesc: isMaterial
        ? '还没有素材库时，先把灵感存下来，之后再补关联也可以。'
        : '还没有排练记录时，不需要先补全结构，保存灵感更重要。'
    })
  },

  chooseLink(event) {
    const value = (event.detail && event.detail.id) || event.currentTarget.dataset.value
    const selected = (this.data.linkOptions || []).find((item) => item.value === value)
    if (!selected) return
    closeModal(this, {
      linkVisible: false,
      linkedMaterial: this.data.linkKind === 'material' ? selected.title : this.data.linkedMaterial,
      linkedMaterialId: this.data.linkKind === 'material' ? selected.value : this.data.linkedMaterialId,
      linkedRehearsal: this.data.linkKind === 'rehearsal' ? selected.title : this.data.linkedRehearsal,
      linkedRehearsalId: this.data.linkKind === 'rehearsal' ? selected.value : this.data.linkedRehearsalId
    })
  },

  closeSheet() {
    closeModal(this, { linkVisible: false })
  },

  async save() {
    if (this.data.saving) return
    const editingId = this.data.editingId
    if (!editingId) {
      toast('未找到灵感记录')
      return
    }
    const payload = {
      title: this.data.titleValue,
      desc: this.data.contentValue,
      meta: this.data.selectedTags,
      linkedMaterialId: this.data.linkedMaterialId,
      linkedMaterialTitle: this.data.linkedMaterial,
      linkedRehearsalId: this.data.linkedRehearsalId,
      linkedRehearsalTitle: this.data.linkedRehearsal
    }
    this.setData({ saving: true })
    try {
      const result = await updateInspiration(editingId, payload)
      if (result && result.item) upsertInspiration(result.item)
      toast('已更新灵感')
      wx.navigateBack()
    } catch (error) {
      this.setData({ saving: false })
      toast('保存失败，请重试')
    }
  }
})
