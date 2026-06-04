Component({
  data: {
    selected: 0,
    hidden: false,
    tabs: [
      { pagePath: '/pages/discover/index', icon: '⌕', text: '发现', activeClass: 'active' },
      { pagePath: '/pages/record/index', icon: '✎', text: '记录', activeClass: '' },
      { pagePath: '/pages/mine/index', icon: '◔', text: '我的', activeClass: '' }
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
    }
  },

  methods: {
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
