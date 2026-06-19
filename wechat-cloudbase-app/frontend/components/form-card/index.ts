Component({
  properties: {
    title: { type: String, value: '' },
    kicker: { type: String, value: '' },
    actionText: { type: String, value: '' },
    actionIcon: { type: String, value: '' }
  },
  methods: {
    onActionTap() {
      this.triggerEvent('action')
    }
  }
})