Component({
  options: {
    addGlobalClass: true
  },
  properties: {
    value: { type: String, value: '' },
    placeholder: { type: String, value: '搜索' },
    hint: { type: String, value: '' },
    showClear: { type: Boolean, value: false },
    size: { type: String, value: 'default' },
    customClass: { type: String, value: '' }
  },
  methods: {
    onFocus(event) {
      this.triggerEvent('focus', event.detail)
    },
    onBlur(event) {
      this.triggerEvent('blur', event.detail)
    },
    onConfirm(event) {
      this.triggerEvent('confirm', event.detail)
    },
    onClear() {
      this.triggerEvent('clear')
    }
  }
})
