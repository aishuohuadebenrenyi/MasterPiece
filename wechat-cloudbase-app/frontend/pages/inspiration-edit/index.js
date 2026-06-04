const { toast } = require('../../utils/page')
const { createInspiration } = require('../../services/inspiration')
const { createMethodCard: createMethodCardRecord } = require('../../services/method-card')
const { addTodayItem } = require('../../services/local-state')

Page({
  data: {
    titleValue: '一句话交换身份可以加限制词',
    contentValue: '每轮只允许推进一个关系信息，现场会更稳。新手不会急着解释背景，也更容易接住对方。',
    linkedGame: '一句话交换身份',
    linkedRehearsal: '',
    voiceVisible: false,
    linkVisible: false,
    insightVisible: false,
    linkKind: 'game',
    linkSheetTitle: '选择关联',
    linkOptions: []
  },

  back() {
    wx.navigateBack()
  },

  updateField(event) {
    const field = event.currentTarget.dataset.field
    this.setData({ [field]: event.detail.value })
  },

  openVoice() {
    this.setData({ voiceVisible: true })
  },

  fillVoiceDraft() {
    this.setData({
      voiceVisible: false,
      titleValue: '开场不要解释太多',
      contentValue: '让大家先玩一轮，再补规则，理解会更快。'
    })
    toast('已填入语音草稿')
  },

  openLink(event) {
    const kind = event.currentTarget.dataset.kind
    const isGame = kind === 'game'
    this.setData({
      linkVisible: true,
      linkKind: kind,
      linkSheetTitle: isGame ? '选择关联' : '选择关联',
      linkOptions: isGame
        ? [
            { value: '一句话交换身份', title: '一句话交换身份', desc: '用一句台词确认彼此身份，快速建立关系。' },
            { value: '空间行走切换', title: '空间行走切换', desc: '现场有点散时，适合重新聚焦身体和节奏。' }
          ]
        : [
            { value: '开心即兴团 · 06.01 排练', title: '开心即兴团 · 06.01 排练', desc: '身体到场 -> 关系建立 -> 小复盘' },
            { value: '开心即兴团 · 05.28 排练', title: '开心即兴团 · 05.28 排练', desc: '新手破冰与身体专注' }
          ]
    })
  },

  chooseLink(event) {
    const value = event.currentTarget.dataset.value
    this.setData({
      linkVisible: false,
      linkedGame: this.data.linkKind === 'game' ? value : this.data.linkedGame,
      linkedRehearsal: this.data.linkKind === 'rehearsal' ? value : this.data.linkedRehearsal
    })
  },

  openInsight() {
    this.setData({ insightVisible: true })
  },

  closeSheet() {
    this.setData({ voiceVisible: false, linkVisible: false, insightVisible: false })
  },

  async save() {
    const item = {
      id: `inspiration-${Date.now()}`,
      type: '灵感',
      title: this.data.titleValue,
      desc: this.data.contentValue,
      meta: ['关系', '新手']
    }
    await createInspiration({
      title: item.title,
      desc: item.desc,
      meta: item.meta
    })
    addTodayItem('todayInspirations', item)
    toast('已保存灵感')
    wx.navigateBack()
  },
  async createMethodCard() {
    this.closeSheet()
    const item = {
      id: `method-${Date.now()}`,
      type: '带领提醒',
      title: this.data.titleValue || '一句话交换身份只推进一个信息',
      desc: this.data.contentValue || '每轮只确认一个关系点，现场会更稳。',
      meta: ['关系', '游戏变体', '可复用']
    }
    await createMethodCardRecord({
      sourceType: 'inspiration',
      title: item.title,
      desc: item.desc,
      meta: item.meta
    })
    addTodayItem('methodCards', item)
    toast('已沉淀为方法卡')
  }
})
