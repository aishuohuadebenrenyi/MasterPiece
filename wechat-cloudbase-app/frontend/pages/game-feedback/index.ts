import type { Game, TodayItem } from '../../types/domain'
import { findLocalGame } from '../../services/game'
import { createGameRecord } from '../../services/game-record'
import { createMethodCard as createMethodCardRecord } from '../../services/method-card'
import { addTodayItem, getState, markPlayed } from '../../store/index'
import { getRouteParam, toast } from '../../utils/page'

Page({
  data: {
    game: null as Game | null,
    recordVisible: false,
    linkVisible: false,
    insightVisible: false,
    recordType: '游戏实践',
    linkedRehearsal: '开心即兴团 · 06.01 排练',
    linkOptions: [
      { value: '开心即兴团 · 06.01 排练', title: '开心即兴团 · 06.01 排练', desc: '身体到场 -> 关系建立 -> 小复盘' },
      { value: '开心即兴团 · 05.28 排练', title: '开心即兴团 · 05.28 排练', desc: '新手破冰与身体专注' }
    ]
  },

  onLoad(options: Record<string, string>) {
    const id = getRouteParam(options, 'id', 'space-walk')
    const game = getState().games.find((item) => item.id === id) || findLocalGame(id)
    this.setData({ game })
  },

  back() {
    wx.navigateBack()
  },

  openVoice() {
    toast('已打开语音速记')
  },

  openConfirm() {
    this.setData({ recordVisible: true })
  },

  closeSheet() {
    this.setData({ recordVisible: false, linkVisible: false, insightVisible: false })
  },

  openLink() {
    this.setData({ linkVisible: true })
  },

  chooseLink(event: WechatMiniprogram.TouchEvent) {
    this.setData({ linkedRehearsal: event.currentTarget.dataset.value, linkVisible: false })
  },

  async saveRecord() {
    if (!this.data.game) return
    this.closeSheet()
    const item: TodayItem = {
      id: `game-record-${Date.now()}`,
      title: `${this.data.game.title} · 游戏实践`,
      desc: 'Keep：大家进入状态很快。Try：下一轮口令少一点。',
      status: '已完成'
    }
    await createGameRecord({
      gameId: this.data.game.id,
      gameTitle: this.data.game.title,
      keep: '大家进入状态很快。',
      try: '下一轮口令少一点。'
    })
    addTodayItem('todayRehearsals', item)
    markPlayed(this.data.game.id)
    toast('记录已保存')
  },

  async createMethodCard() {
    this.setData({ recordVisible: false, insightVisible: true })
  },

  async saveMethodCard() {
    if (!this.data.game) return
    this.closeSheet()
    const item: TodayItem = {
      id: `method-${Date.now()}`,
      type: '带领提醒',
      title: `${this.data.game.title}的带领提醒`,
      desc: '下一轮口令少一点，让感受多一点。'
    }
    await createMethodCardRecord({
      sourceType: 'gameRecord',
      title: item.title,
      desc: item.desc,
      meta: ['游戏实践', this.data.game.title]
    })
    addTodayItem('methodCards', item)
    toast('已沉淀为方法卡')
  }
})
