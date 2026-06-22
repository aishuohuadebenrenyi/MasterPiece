Component({
  options: {
    addGlobalClass: true
  },
  properties: {
    badgeText: { type: String, value: '' },
    badgeTone: { type: String, value: 'blue' },
    pending: { type: Boolean, value: false },
    title: { type: String, value: '' },
    desc: { type: String, value: '' },
    meta: { type: Array, value: [] },
    canSediment: { type: Boolean, value: false },
    canMarkIntent: { type: Boolean, value: false },
    selectedIntent: { type: String, value: '' },
    canEdit: { type: Boolean, value: false },
    loading: { type: Boolean, value: false }
  },
  methods: {
    onEdit() {
      this.triggerEvent('edit')
    },
    onDiscard() {
      this.triggerEvent('discard')
    },
    onSediment() {
      this.triggerEvent('sediment')
    },
    onMarkIntent(event) {
      this.triggerEvent('markintent', { intent: event.currentTarget.dataset.intent })
    }
  }
})
