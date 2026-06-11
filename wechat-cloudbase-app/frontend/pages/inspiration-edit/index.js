const { toast } = require('../../utils/page')
const { createInspiration } = require('../../services/inspiration')
const { createMethodCard: createMethodCardRecord } = require('../../services/method-card')
const { getLayoutStyle } = require('../../utils/layout')
const { closeModal, openModal } = require('../../utils/modal')
const {
  addInspiration,
  addMethodCard,
  clearVoiceDraft,
  getState,
  getThemeClass
} = require('../../store/index')

Page({
  data: {
    themeClass: 'theme-default',
    titleValue: '',
    contentValue: '',
    linkedGame: '',
    linkedRehearsal: '',
    arrangementValue: '带领提醒',
    selectedTags: [],
    voiceVisible: false,
    linkVisible: false,
    insightVisible: false,
    modalOpen: false,
    linkKind: 'game',
    linkSheetTitle: '选择关联游戏',
    linkOptions: [],
    linkEmptyTitle: '',
    linkEmptyDesc: '',
    showLinkSection: true,
    arrangementOptions: [],
    tagOptions: [],
    arrangementLabel: '带领提醒',
    draftTitle: '',
    draftSummary: '',
    layoutStyle: ''
  },

  onShow() {
    this.setData({ themeClass: getThemeClass() })
  },
  getLinkOptions(kind) {
    const state = getState()
    if (kind === 'game') {
      return (state.games || []).slice(0, 6).map((item) => ({
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
        { value: '游戏变体', label: '游戏变体' },
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

  onLoad() {
    this.setData({
      layoutStyle: getLayoutStyle(),
      themeClass: getThemeClass()
    })
    const state = getState()
    const draft = state.voiceDraft
    const currentRehearsal = state.currentRehearsal
    const rehearsalHistory = state.rehearsalHistory || []
    if (draft) {
      const linkedGame = state.games.find((item) => item.id === draft.linkedGameId)
      const linkedRehearsal = (currentRehearsal && currentRehearsal.id === draft.linkedRehearsalId
        ? currentRehearsal
        : rehearsalHistory.find((item) => item.id === draft.linkedRehearsalId)) || null
      this.setData({
        titleValue: draft.title,
        contentValue: draft.desc,
        linkedGame: linkedGame ? linkedGame.title : this.data.linkedGame,
        linkedRehearsal: linkedRehearsal ? linkedRehearsal.title : this.data.linkedRehearsal,
        draftTitle: draft.title,
        draftSummary: draft.summary
      })
    }
    this.setData({
      showLinkSection: !!((state.games || []).length || rehearsalHistory.length || this.data.linkedGame || this.data.linkedRehearsal)
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

  openVoice() {
    openModal(this, { voiceVisible: true })
  },

  fillVoiceDraft() {
    const draft = getState().voiceDraft
    closeModal(this, {
      voiceVisible: false,
      titleValue: draft ? draft.title : this.data.draftTitle,
      contentValue: draft ? draft.desc : this.data.draftSummary
    })
    toast('已填入语音草稿')
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
    const isGame = kind === 'game'
    const linkOptions = this.getLinkOptions(kind)
    openModal(this, {
      linkVisible: true,
      linkKind: kind,
      linkSheetTitle: isGame ? '选择关联游戏' : '选择关联排练',
      linkOptions,
      linkEmptyTitle: isGame ? '暂时没有可关联的游戏' : '暂时没有可关联的排练',
      linkEmptyDesc: isGame
        ? '还没有游戏库时，先把灵感存下来，之后再补关联也可以。'
        : '还没有排练记录时，不需要先补全结构，保存灵感更重要。'
    })
  },

  chooseLink(event) {
    const value = (event.detail && event.detail.id) || event.currentTarget.dataset.value
    closeModal(this, {
      linkVisible: false,
      linkedGame: this.data.linkKind === 'game' ? value : this.data.linkedGame,
      linkedRehearsal: this.data.linkKind === 'rehearsal' ? value : this.data.linkedRehearsal
    })
  },

  openInsight() {
    openModal(this, { insightVisible: true })
  },

  closeSheet() {
    closeModal(this, { voiceVisible: false, linkVisible: false, insightVisible: false })
  },

  async save() {
    const item = {
      id: `inspiration-${Date.now()}`,
      type: '灵感',
      title: this.data.titleValue,
      desc: this.data.contentValue,
      meta: this.data.selectedTags,
      linkedGameTitle: this.data.linkedGame,
      linkedRehearsalTitle: this.data.linkedRehearsal
    }
    try {
      await createInspiration({
        title: item.title,
        desc: item.desc,
        meta: item.meta,
        linkedGameTitle: item.linkedGameTitle,
        linkedRehearsalTitle: item.linkedRehearsalTitle
      })
      addInspiration(item)
      toast('已保存灵感')
    } catch (error) {
      addInspiration(Object.assign({}, item, { syncStatus: 'pending' }))
      toast('已本地保存，待同步')
    }
    clearVoiceDraft()
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
    clearVoiceDraft()
  }
})
