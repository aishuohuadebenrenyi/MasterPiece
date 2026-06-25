Component({
  properties: {
    title: { type: String, value: '' },
    kicker: { type: String, value: '' },
    actionText: { type: String, value: '' },
    actionIcon: { type: String, value: '' },
    contentSafe: { type: Boolean, value: false }
  },
  methods: {
    onActionTap() {
      this.triggerEvent('action')
    }
  }
})
