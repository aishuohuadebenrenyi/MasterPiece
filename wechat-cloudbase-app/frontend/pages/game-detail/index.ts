import type { Game } from '../../types/domain'
import { findLocalGame, listGames, updateGameState } from '../../services/game'
import { getState, markPlayed, setGames, toggleSaved } from '../../store/index'
import { getRouteParam, toast } from '../../utils/page'

Page({
  data: {
    game: null as Game | null,
    related: null as Game | null,
    saved: false,
    played: false,
    saveIcon: '☆',
    savedText: '☆ 收藏',
    playedText: '○ 玩过',
    tagText: '',
    verdictText: '',
    avoidText: ''
  },

  syncStatusText() {
    this.setData({
      saveIcon: this.data.saved ? '★' : '☆',
      savedText: this.data.saved ? '★ 已收藏' : '☆ 收藏',
      playedText: this.data.played ? '✓ 已玩过' : '○ 玩过'
    })
  },

  async onLoad(options: Record<string, string>) {
    const id = getRouteParam(options, 'id', 'space-walk')
    let allGames = getState().games
    try {
      allGames = await listGames()
      setGames(allGames)
    } catch (error) {
      allGames = getState().games
    }
    const game = allGames.find((item) => item.id === id) || findLocalGame(id)
    const related = allGames.find((item) => item.id === game.relatedGameId) || findLocalGame(game.relatedGameId)
    const state = getState()
    this.setData({
      game,
      related,
      tagText: game.tags.join(' · '),
      verdictText: game.verdict || game.lead,
      avoidText: game.avoid || game.issue,
      saved: state.savedGameIds.includes(id),
      played: state.playedGameIds.includes(id)
    }, () => this.syncStatusText())
  },

  back() {
    wx.navigateBack()
  },

  async toggleSaved() {
    if (!this.data.game) return
    const saved = toggleSaved(this.data.game.id)
    this.setData({ saved }, () => this.syncStatusText())
    await updateGameState(this.data.game.id, { saved })
  },

  async togglePlayed() {
    if (!this.data.game) return
    markPlayed(this.data.game.id)
    this.setData({ played: true }, () => this.syncStatusText())
    await updateGameState(this.data.game.id, { played: true })
    toast('已标记玩过')
  },

  openRelated() {
    if (!this.data.related) return
    wx.redirectTo({ url: `/pages/game-detail/index?id=${this.data.related.id}` })
  },

  record() {
    if (!this.data.game) return
    wx.navigateTo({ url: `/pages/game-feedback/index?id=${this.data.game.id}` })
  }
})
