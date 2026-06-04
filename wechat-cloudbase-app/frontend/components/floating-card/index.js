Component({
  properties: {
    visible: Boolean,
    title: String,
    count: String
  },
  methods: {
    close() {
      this.triggerEvent('close')
    },
    prev() {
      this.triggerEvent('prev')
    },
    next() {
      this.triggerEvent('next')
    }
  }
})

