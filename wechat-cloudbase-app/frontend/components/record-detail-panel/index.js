Component({
  options: {
    addGlobalClass: true
  },
  properties: {
    title: { type: String, value: '' },
    desc: { type: String, value: '' },
    meta: { type: Array, value: [] },
    pending: { type: Boolean, value: false },
    notes: { type: Array, value: [] },
    emptyText: { type: String, value: '' },
    sectionTitle: { type: String, value: '' },
    plan: { type: Array, value: [] },
    planEmptyText: { type: String, value: '' },
    readonlyNote: { type: String, value: '' }
  }
})
