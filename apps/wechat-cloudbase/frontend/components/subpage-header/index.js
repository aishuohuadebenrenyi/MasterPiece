Component({
  options: {
    multipleSlots: true,
    addGlobalClass: true
  },
  properties: {
    kicker: { type: String, value: '' },
    title: { type: String, value: '' },
    customClass: { type: String, value: '' }
  },
  methods: {
    onBack() {
      this.triggerEvent('back')
    }
  }
})
