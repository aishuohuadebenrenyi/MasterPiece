Component({
  options: {
    addGlobalClass: true
  },
  properties: {
    itemId: { type: String, value: '' },
    layoutKind: { type: String, value: 'summary' },
    eyebrow: { type: String, value: '' },
    title: { type: String, value: '' },
    bodyText: { type: String, value: '' },
    metaPills: { type: Array, value: [] },
    pending: { type: Boolean, value: false },
    primaryActionText: { type: String, value: '' },
    secondaryActionText: { type: String, value: '' },
    badgeText: { type: String, value: '' },
    badgeTone: { type: String, value: 'blue' },
    customClass: { type: String, value: '' }
  },
  data: {
    swiped: false,
    touchStartX: 0,
    touchStartY: 0
  },
  methods: {
    onTouchStart(event) {
      const touch = event.touches && event.touches[0]
      if (!touch) return
      this.setData({
        touchStartX: touch.clientX,
        touchStartY: touch.clientY
      })
    },
    onTouchEnd(event) {
      if (!this.data.secondaryActionText) return
      const touch = event.changedTouches && event.changedTouches[0]
      if (!touch) return
      const deltaX = touch.clientX - this.data.touchStartX
      const deltaY = touch.clientY - this.data.touchStartY
      if (Math.abs(deltaY) > Math.abs(deltaX)) return
      if (deltaX < -36) {
        this.setData({ swiped: true })
      } else if (deltaX > 24) {
        this.setData({ swiped: false })
      }
    },
    onActionTap() {
      this.setData({ swiped: false })
      this.triggerEvent('action', { id: this.data.itemId })
    },
    onDangerTap() {
      this.setData({ swiped: false })
      this.triggerEvent('danger', { id: this.data.itemId })
    },
    onCardTap() {
      if (this.data.swiped) {
        this.setData({ swiped: false })
        return
      }
      this.triggerEvent('tapcard', { id: this.data.itemId })
    }
  }
})
