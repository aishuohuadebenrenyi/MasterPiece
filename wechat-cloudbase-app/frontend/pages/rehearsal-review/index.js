const { toast } = require('../../utils/page')
const { createGameRecord } = require('../../services/game-record')
const { createMethodCard: createMethodCardRecord } = require('../../services/method-card')

Page({
  data: {
    confirmVisible: false,
    insightVisible: false
  },
  back() {
    wx.navigateBack()
  },
  openConfirm() {
    this.setData({ confirmVisible: true })
  },
  closeSheet() {
    this.setData({ confirmVisible: false, insightVisible: false })
  },
  async save() {
    this.closeSheet()
    await createGameRecord({
      type: 'rehearsalReview',
      rehearsalId: 'today-rehearsal',
      keep: '大家进入状态很快。',
      try: '下一轮口令少一点。'
    })
    toast('复盘已保存')
  },
  createMethodCard() {
    this.setData({ confirmVisible: false, insightVisible: true })
  },

  async saveMethodCard() {
    await createMethodCardRecord({
      sourceType: 'rehearsalReview',
      title: '开场不要解释太多',
      desc: '新手场先用身体和声音统一节奏。'
    })
    this.closeSheet()
    toast('已沉淀为方法卡')
  }
})
