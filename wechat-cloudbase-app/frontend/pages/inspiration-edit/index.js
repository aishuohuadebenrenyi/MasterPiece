const { toast } = require('../../utils/page')
const { createInspiration } = require('../../services/inspiration')
const { createMethodCard: createMethodCardRecord } = require('../../services/method-card')
const { getLayoutStyle } = require('../../utils/layout')
const { closeModal, openModal } = require('../../utils/modal')
const {
  addInspiration,
  addMethodCard,
  clearVoiceDraft,
  getState
} = require('../../store/index')

Page({
  data: {
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
    arrangementOptions: [],
    tagOptions: [],
    arrangementLabel: '带领提醒',
    draftTitle: '',
    draftSummary: '',
    layoutStyle: ''
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
    this.setData({ layoutStyle: getLayoutStyle() })
    const state = getState()
    const draft = state.voiceDraft
    const currentRehearsal = state.currentRehearsal
    if (draft) {
      const linkedGame = state.games.find((item) => item.id === draft.linkedGameId)
      this.setData({
        titleValue: draft.title,
        contentValue: draft.desc,
        linkedGame: linkedGame ? linkedGame.title : this.data.linkedGame,
        linkedRehearsal: currentRehearsal && currentRehearsal.id === draft.linkedRehearsalId ? currentRehearsal.title : this.data.linkedRehearsal,
        draftTitle: draft.title,
        draftSummary: draft.summary
      })
    }
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
    this.setData({ arrangementValue: event.currentTarget.dataset.value }, () => this.syncOptions())
  },

  toggleTag(event) {
    const value = event.currentTarget.dataset.value
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
    const state = getState()
    const rehearsalOptions = (state.rehearsalHistory || []).slice(0, 4).map((item) => ({
      value: item.title,
      title: item.title,
      desc: item.desc
    }))
    openModal(this, {
      linkVisible: true,
      linkKind: kind,
      linkSheetTitle: isGame ? '选择关联游戏' : '选择关联排练',
      linkOptions: isGame
        ? state.games.slice(0, 6).map((item) => ({
            value: item.title,
            title: item.title,
            desc: item.desc
          }))
        : rehearsalOptions
    })
  },

  chooseLink(event) {
    const value = event.currentTarget.dataset.value
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
    await createInspiration({
      title: item.title,
      desc: item.desc,
      meta: item.meta,
      linkedGameTitle: item.linkedGameTitle,
      linkedRehearsalTitle: item.linkedRehearsalTitle
    })
    addInspiration(item)
    clearVoiceDraft()
    toast('已保存灵感')
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
    await createMethodCardRecord({
      sourceType: 'inspiration',
      title: item.title,
      desc: item.desc,
      meta: item.meta
    })
    addMethodCard(item)
    clearVoiceDraft()
    toast('已沉淀为方法卡')
  }
})
