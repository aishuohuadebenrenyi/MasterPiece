Component({
  options: {
    addGlobalClass: true,
    multipleSlots: true
  },
  properties: {
    label: { type: String, value: '' },
    options: { type: Array, value: [] },
    customClass: { type: String, value: '' },
    rowClass: { type: String, value: '' },
    chipClass: { type: String, value: '' },
    wrap: { type: Boolean, value: false }
  },
  methods: {
    onSelect(event) {
      this.triggerEvent('select', {
        value: event.currentTarget.dataset.value
      })
    }
  }
})
