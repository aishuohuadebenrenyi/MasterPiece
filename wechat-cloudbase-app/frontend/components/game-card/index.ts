import type { Material } from '../../types/domain'

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
    'game, mode, saved': function syncView(material: Material, mode: string, saved: boolean) {
      if (!material) return
      const displayMeta = Array.isArray(material.meta) ? material.meta.filter((item) => typeof item === 'string' && item.trim()) : []
      this.setData({
        modeClass: mode === 'card' ? 'large' : '',
        isCard: mode === 'card',
        primaryTag: material.type || (material.tags && material.tags.length ? material.tags[0] : '素材'),
        saveIcon: saved || material.saved ? '♥︎' : '♡',
        stripeClass: material.stripeTone || 'orange',
        displayMeta
      })
    }
  },
  methods: {
    open() {
      this.triggerEvent('open', { id: (this.data.game as Material).id })
    },
    save() {
      this.triggerEvent('save', { id: (this.data.game as Material).id })
    }
  }
})
