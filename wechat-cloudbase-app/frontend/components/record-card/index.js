Component({
  options: {
    addGlobalClass: true
  },
  properties: {
    itemId: { type: String, value: '' },
    miniTitle: { type: String, value: '' },
    title: { type: String, value: '' },
    desc: { type: String, value: '' },
    meta: { type: Array, value: [] },
    pending: { type: Boolean, value: false },
    actionText: { type: String, value: '' },
    badgeText: { type: String, value: '' },
    badgeTone: { type: String, value: 'blue' },
    customClass: { type: String, value: '' }
  },
  methods: {
    onActionTap() {
      this.triggerEvent('action', { id: this.data.itemId })
    },
    onCardTap() {
      this.triggerEvent('tapcard', { id: this.data.itemId })
    }
  }
})
