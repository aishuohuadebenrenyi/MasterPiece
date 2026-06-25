import { subscribe, getThemeClass } from '../store/index'

Component({
  data: {
    themeClass: 'theme-default',
    selected: 0,
    hidden: false,
    tabs: [
      { pagePath: '/pages/discover/index', icon: '/assets/tabbar/discover.png', text: '发现', activeClass: 'active' },
      { pagePath: '/pages/record/index', icon: '/assets/tabbar/record.png', text: '记录', activeClass: '' },
      { pagePath: '/pages/mine/index', icon: '/assets/tabbar/mine.png', text: '我的', activeClass: '' }
    ]
  },

  observers: {
    selected(selected: number) {
      this.syncTabs(selected)
    }
  },

  lifetimes: {
    attached() {
      this.syncTabs(this.data.selected)
      this._unsubscribe = subscribe(() => {
        const themeClass = getThemeClass()
        if (this.data.themeClass !== themeClass) {
          this.setData({ themeClass })
        }
      })
    },
    detached() {
      if (this._unsubscribe) this._unsubscribe()
    }
  },

  methods: {
    setHidden(hidden: boolean) {
      if (this.data.hidden !== hidden) {
        this.setData({ hidden })
      }
    },

    syncTabs(selected: number) {
      this.setData({
        tabs: this.data.tabs.map((item, index) => Object.assign({}, item, {
          activeClass: selected === index ? 'active' : ''
        }))
      })
    },

    switchTab(event: WechatMiniprogram.TouchEvent) {
      const index = Number(event.currentTarget.dataset.index)
      const target = this.data.tabs[index]
      if (!target || index === this.data.selected) return
      wx.switchTab({ url: target.pagePath })
    }
  }
})
