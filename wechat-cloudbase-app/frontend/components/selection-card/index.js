Component({
  options: {
    addGlobalClass: true,
    multipleSlots: true
  },
  properties: {
    itemId: { type: String, value: '' },
    kicker: { type: String, value: '' },
    title: { type: String, value: '' },
    desc: { type: String, value: '' },
    meta: { type: Array, value: [] },
    pending: { type: Boolean, value: false },
    badgeText: { type: String, value: '' },
    badgeTone: { type: String, value: 'blue' },
    actionText: { type: String, value: '' },
    selected: { type: Boolean, value: false },
    selectedText: { type: String, value: '已选' },
    customClass: { type: String, value: '' }
  },
  methods: {
    onCardTap() {
      this.triggerEvent('tapcard', { id: this.data.itemId })
    },
    onActionTap() {
      this.triggerEvent('action', { id: this.data.itemId })
    }
  }
})
