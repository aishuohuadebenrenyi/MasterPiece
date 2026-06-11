Component({
  options: {
    addGlobalClass: true
  },
  properties: {
    kicker: { type: String, value: '' },
    kickerTone: { type: String, value: 'blue' },
    title: { type: String, value: '' },
    desc: { type: String, value: '' },
    primaryText: { type: String, value: '' },
    secondaryText: { type: String, value: '' },
    customClass: { type: String, value: '' }
  },
  methods: {
    onPrimary() {
      this.triggerEvent('primary')
    },
    onSecondary() {
      this.triggerEvent('secondary')
    }
  }
})
