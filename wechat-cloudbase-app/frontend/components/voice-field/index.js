Component({
  options: {
    multipleSlots: true,
    addGlobalClass: true
  },
  properties: {
    label: { type: String, value: '' },
    desc: { type: String, value: '' },
    voiceTarget: { type: String, value: '' },
    multiline: { type: Boolean, value: false }
  },
  methods: {
    onVoiceTap() {
      this.triggerEvent('voice', { target: this.data.voiceTarget })
    }
  }
})
