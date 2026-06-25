function getEventValue(event) {
  return event && event.detail ? event.detail.value : ''
}

Component({
  properties: {
    value: { type: Object, value: {} },
    typeOptions: { type: Array, value: [] },
    abilityOptions: { type: Array, value: [] },
    sceneOptions: { type: Array, value: [] },
    tagOptions: { type: Array, value: [] },
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
    selectType(event) {
      this.triggerEvent('selecttype', { value: event.detail.value })
    },
    selectAbility(event) {
      this.triggerEvent('selectability', { value: event.detail.value })
    },
    selectScene(event) {
      this.triggerEvent('selectscene', { value: event.detail.value })
    },
    selectTag(event) {
      this.triggerEvent('selecttag', { value: event.detail.value })
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
