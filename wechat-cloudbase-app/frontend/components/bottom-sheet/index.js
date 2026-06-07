Component({
  options: {
    multipleSlots: true
  },
  properties: {
    visible: Boolean,
    title: String,
    maskVariant: {
      type: String,
      value: 'medium'
    },
    closeOnMask: {
      type: Boolean,
      value: true
    },
    sheetClass: {
      type: String,
      value: ''
    },
    showActions: {
      type: Boolean,
      value: false
    },
    bodyMode: {
      type: String,
      value: 'scroll'
    },
    maskClass: {
      type: String,
      value: ''
    }
  },
  data: {
    mounted: false,
    showClass: '',
    maskVisibleClass: '',
    resolvedMaskVariant: 'light',
    resolvedBodyMode: 'scroll'
  },
  lifetimes: {
    detached() {
      if (this._hideTimer) clearTimeout(this._hideTimer)
      if (this._showTimer) clearTimeout(this._showTimer)
    }
  },
  observers: {
    visible(value) {
      if (value) {
        if (this._hideTimer) clearTimeout(this._hideTimer)
        this.setData({
          mounted: true,
          resolvedMaskVariant: this.normalizeMaskVariant(this.data.maskVariant),
          resolvedBodyMode: this.normalizeBodyMode(this.data.bodyMode)
        })
        this._showTimer = setTimeout(() => {
          this.setData({ showClass: 'show', maskVisibleClass: 'visible' })
        }, 20)
        return
      }
      if (this._showTimer) clearTimeout(this._showTimer)
      this.setData({ showClass: '', maskVisibleClass: '' })
      this._hideTimer = setTimeout(() => {
        this.setData({ mounted: false })
      }, 260)
    },
    maskVariant(value) {
      this.setData({ resolvedMaskVariant: this.normalizeMaskVariant(value) })
    },
    bodyMode(value) {
      this.setData({ resolvedBodyMode: this.normalizeBodyMode(value) })
    }
  },
  methods: {
    normalizeMaskVariant(value) {
      return ['light', 'medium', 'strong'].includes(value) ? value : 'light'
    },
    normalizeBodyMode(value) {
      return ['scroll', 'fit'].includes(value) ? value : 'scroll'
    },
    noop() {},
    closeFromMask() {
      if (!this.data.closeOnMask) return
      this.close()
    },
    close() {
      this.triggerEvent('close')
    }
  }
})
