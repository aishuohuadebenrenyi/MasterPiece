import type { TodayItem, VoiceTarget } from '../../types/domain'
import { addTodayItem, getState, subscribe } from '../../store/index'
import { fetchTodaySummary } from '../../services/today'
import { toast } from '../../utils/page'
import { closeModal, openModal } from '../../utils/modal'
import { syncTabBar } from '../../utils/tabbar'

Page({
  data: {
    voiceVisible: false,
    elapsed: 0,
    timeText: '00:00',
    recordingText: '录音中',
    timer: null as number | null,
    voiceTarget: 'inspiration' as VoiceTarget,
    pausedRehearsal: null,
    recommendVisible: true,
    todayVisible: false,
    startRehearsalVisible: false,
    modalOpen: false,
    todayTitle: '',
    todayItems: [] as TodayItem[],
    inspirationCount: 0,
    rehearsalCount: 0,
    teamName: '开心即兴团',
    rehearsalDuration: '90',
    rehearsalGoals: ['身体到场', '关系建立'] as string[],
    rehearsalSource: 'recommended',
    voiceTargets: [] as Array<{ value: VoiceTarget; label: string; activeClass: string }>,
    durationOptions: [] as Array<{ value: string; label: string; activeClass: string }>,
    goalOptions: [] as Array<{ value: string; label: string; activeClass: string }>,
    sourceOptions: [] as Array<{ value: string; label: string; activeClass: string }>
  },

  unsubscribeStore: null as null | (() => void),

  formatTime(seconds: number) {
    const m = String(Math.floor(seconds / 60)).padStart(2, '0')
    const s = String(seconds % 60).padStart(2, '0')
    return `${m}:${s}`
  },

  syncLocalState() {
    const state = getState()
    const targetOptions = [
      { value: 'inspiration' as VoiceTarget, label: '记录到：灵感' },
      { value: 'game_feedback' as VoiceTarget, label: '当前游戏' },
      { value: 'rehearsal' as VoiceTarget, label: '当前排练' }
    ]
    this.setData({
      pausedRehearsal: state.pausedRehearsal,
      inspirationCount: state.todayInspirations.length,
      rehearsalCount: state.todayRehearsals.length,
      durationOptions: [
        { value: '60', label: '60 分钟' },
        { value: '90', label: '90 分钟' },
        { value: '120', label: '120 分钟' }
      ].map((item) => Object.assign({}, item, {
        activeClass: this.data.rehearsalDuration === item.value ? 'active' : ''
      })),
      goalOptions: [
        { value: '身体到场', label: '身体到场' },
        { value: '关系建立', label: '关系建立' },
        { value: '叙事', label: '叙事' },
        { value: '演出前', label: '演出前' }
      ].map((item) => Object.assign({}, item, {
        activeClass: this.data.rehearsalGoals.includes(item.value) ? 'active' : ''
      })),
      sourceOptions: [
        { value: 'recommended', label: '使用推荐 3 个' },
        { value: 'saved', label: '从收藏添加' },
        { value: 'blank', label: '空白开始' }
      ].map((item) => Object.assign({}, item, {
        activeClass: this.data.rehearsalSource === item.value ? 'active' : ''
      })),
      voiceTargets: targetOptions.map((item) => Object.assign({}, item, {
        activeClass: this.data.voiceTarget === item.value ? 'active' : ''
      }))
    })
  },

  async onLoad() {
    this.unsubscribeStore = subscribe(() => this.syncLocalState())
    await fetchTodaySummary()
  },

  onShow() {
    syncTabBar(this, 1)
    this.syncLocalState()
  },

  onUnload() {
    if (this.data.timer) clearInterval(this.data.timer)
    if (this.unsubscribeStore) this.unsubscribeStore()
  },

  openVoice() {
    openModal(this, { voiceVisible: true, elapsed: 0, timeText: '00:00', recordingText: '录音中', voiceTarget: 'inspiration' }, () => {
      this.syncLocalState()
    })
    this.startTimer()
  },

  startTimer() {
    if (this.data.timer) return
    const timer = setInterval(() => {
      const elapsed = this.data.elapsed + 1
      this.setData({ elapsed, timeText: this.formatTime(elapsed), recordingText: '录音中' })
    }, 1000) as unknown as number
    this.setData({ timer })
  },

  pauseVoice() {
    if (this.data.timer) clearInterval(this.data.timer)
    this.setData({ timer: null, recordingText: '继续录音' })
  },

  finishVoice() {
    if (this.data.timer) clearInterval(this.data.timer)
    const elapsed = this.data.elapsed || 36
    this.setData({ timer: null, elapsed, timeText: this.formatTime(elapsed), recordingText: '重新录音' })
    addTodayItem('todayInspirations', {
      id: `voice-${Date.now()}`,
      type: '灵感',
      title: '刚才的语音速记',
      desc: '起手进入状态很快，后半段节奏开始松掉，下次可以加一句更明确的限制词。'
    })
    toast('语音已生成摘要')
  },

  closeSheet() {
    if (this.data.timer) clearInterval(this.data.timer)
    closeModal(this, { voiceVisible: false, todayVisible: false, startRehearsalVisible: false, timer: null })
  },

  setVoiceTarget(event: WechatMiniprogram.TouchEvent) {
    this.setData({ voiceTarget: event.currentTarget.dataset.target as VoiceTarget }, () => this.syncLocalState())
  },

  saveVoiceAsInspiration() {
    this.closeSheet()
    wx.navigateTo({ url: '/pages/inspiration-edit/index' })
  },

  saveVoiceContext() {
    const target = this.data.voiceTarget
    this.closeSheet()
    if (target === 'game_feedback') {
      wx.navigateTo({ url: '/pages/game-feedback/index?id=status-swap' })
      return
    }
    if (target === 'rehearsal') {
      wx.navigateTo({ url: '/pages/rehearsal-record/index' })
      return
    }
    wx.navigateTo({ url: '/pages/inspiration-edit/index' })
  },

  openStartRehearsal() {
    openModal(this, { startRehearsalVisible: true }, () => {
      this.syncLocalState()
    })
  },

  updateStartForm(event: WechatMiniprogram.Input) {
    const field = event.currentTarget.dataset.field
    this.setData({ [field]: event.detail.value })
  },

  setDuration(event: WechatMiniprogram.TouchEvent) {
    this.setData({ rehearsalDuration: event.currentTarget.dataset.value }, () => this.syncLocalState())
  },

  toggleGoal(event: WechatMiniprogram.TouchEvent) {
    const value = event.currentTarget.dataset.value as string
    const exists = this.data.rehearsalGoals.includes(value)
    const rehearsalGoals = exists
      ? this.data.rehearsalGoals.filter((item) => item !== value)
      : this.data.rehearsalGoals.concat(value)
    this.setData({ rehearsalGoals }, () => this.syncLocalState())
  },

  setSource(event: WechatMiniprogram.TouchEvent) {
    this.setData({ rehearsalSource: event.currentTarget.dataset.value }, () => this.syncLocalState())
  },

  resumeRehearsal() {
    wx.navigateTo({ url: '/pages/rehearsal-record/index' })
  },

  startRehearsal() {
    this.closeSheet()
    wx.navigateTo({ url: '/pages/rehearsal-record/index' })
  },

  openToday(event: WechatMiniprogram.TouchEvent) {
    const kind = event.currentTarget.dataset.kind
    const state = getState()
    const items = kind === 'inspirations' ? state.todayInspirations : state.todayRehearsals
    if (!items.length) {
      toast('今日还没有记录，快去玩个游戏吧')
      return
    }
    openModal(this, {
      todayVisible: true,
      todayTitle: kind === 'inspirations' ? '今日灵感' : '今日排练记录',
      todayItems: items
    })
  },

  closeRecommend() {
    this.setData({ recommendVisible: false })
  },

  openRecommend() {
    wx.navigateTo({ url: '/pages/game-detail/index?id=status-swap' })
  }
})
