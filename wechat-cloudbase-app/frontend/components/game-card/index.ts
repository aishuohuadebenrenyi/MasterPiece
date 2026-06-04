import type { Game } from '../../types/domain'

Component({
  properties: {
    game: Object,
    mode: {
      type: String,
      value: 'list'
    },
    saved: Boolean
  },
  observers: {
    'game, mode, saved': function syncView(game: Game, mode: string, saved: boolean) {
      if (!game) return
      this.setData({
        modeClass: mode === 'card' ? 'large' : '',
        isCard: mode === 'card',
        primaryTag: game.tags && game.tags.length ? game.tags[0] : '游戏',
        saveIcon: saved || game.saved ? '★' : '☆',
        stripeClass: game.stripeTone || 'orange'
      })
    }
  },
  methods: {
    open() {
      this.triggerEvent('open', { id: (this.data.game as Game).id })
    },
    record() {
      this.triggerEvent('record', { id: (this.data.game as Game).id })
    },
    save() {
      this.triggerEvent('save', { id: (this.data.game as Game).id })
    }
  }
})
