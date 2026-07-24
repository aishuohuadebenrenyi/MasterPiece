import { subscribe, getThemeClass } from '../../store/index'

Component({
  properties: {
    visible: Boolean,
    title: String,
    count: String
  },
  data: {
    themeClass: 'theme-default',
    touchStartX: 0,
    touchStartY: 0
  },
  lifetimes: {
    attached() {
      // @ts-ignore
      this._unsubscribe = subscribe(() => {
        const themeClass = getThemeClass()
        if (this.data.themeClass !== themeClass) {
          this.setData({ themeClass })
        }
      })
    },
    detached() {
      // @ts-ignore
      if (this._unsubscribe) this._unsubscribe()
    }
  },
  methods: {
    noop() {},
    close() {
      this.triggerEvent('close')
    },
    prev() {
      this.triggerEvent('prev')
    },
    next() {
      this.triggerEvent('next')
    },
    handleTouchStart(event: any) {
      if (event.changedTouches && event.changedTouches.length > 0) {
        this.setData({
          touchStartX: event.changedTouches[0].clientX,
          touchStartY: event.changedTouches[0].clientY
        })
      }
    },
    handleTouchEnd(event: any) {
      if (event.changedTouches && event.changedTouches.length > 0) {
        const endX = event.changedTouches[0].clientX
        const endY = event.changedTouches[0].clientY
        const deltaX = endX - this.data.touchStartX
        const deltaY = endY - this.data.touchStartY

        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 40) {
          if (deltaX < 0) {
            this.next()
          } else {
            this.prev()
          }
        }
      }
    }
  }
})