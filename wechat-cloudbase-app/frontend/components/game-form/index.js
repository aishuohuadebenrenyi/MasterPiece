function getEventValue(event) {
  return event && event.detail ? event.detail.value : ''
}

Component({
  options: {
    addGlobalClass: true
  },
  properties: {
    value: { type: Object, value: {} },
    categoryOptions: { type: Array, value: [] },
    customCategoryVisible: { type: Boolean, value: false },
    customCategoryInput: { type: String, value: '' },
    customCategoryFocus: { type: Boolean, value: false },
    categorySuggestions: { type: Array, value: [] },
    showMoreOptions: { type: Boolean, value: false },
    moreOptionsToggleText: { type: String, value: '补充玩法与提示' }
  },
  methods: {
    emitFieldChange(event) {
      const field = event.currentTarget.dataset.field
      this.triggerEvent('fieldchange', { field, value: getEventValue(event) })
    },
    emitVoice(event) {
      this.triggerEvent('voice', event.detail)
    },
    toggleCategory(event) {
      this.triggerEvent('togglecategory', { category: event.currentTarget.dataset.category })
    },
    toggleCustomCategory() {
      this.triggerEvent('togglecustomcategory')
    },
    customCategoryFocus() {
      this.triggerEvent('customcategoryfocus')
    },
    customCategoryBlur(event) {
      this.triggerEvent('customcategoryblur', { value: getEventValue(event) })
    },
    customCategoryConfirm(event) {
      this.triggerEvent('customcategoryconfirm', { value: getEventValue(event) })
    },
    selectSuggestion(event) {
      this.triggerEvent('selectsuggestion', { category: event.currentTarget.dataset.category })
    },
    toggleMore() {
      this.triggerEvent('togglemore')
    }
  }
})
