import type { Material, MaterialType } from '../../types/domain'
import { findLocalMaterial, listMaterials, updateMaterialState, updateMaterial, deleteMaterial } from '../../services/material'
import { getState, markPlayed, unmarkPlayed, setMaterials, toggleSaved, startMaterialSession, subscribe, updateMaterialSession, clearMaterialSession , getThemeClass } from '../../store/index'
import { getRouteParam, toast } from '../../utils/page'
import { getLayoutStyle } from '../../utils/layout'

const materialTypes: MaterialType[] = ['游戏', '角色', '才艺', '格式', '主理', '技巧', '复盘', '路径']
const defaultCategoryOptions = ['游戏', '角色', '才艺', '格式', '主理', '技巧', '复盘', '路径']
const abilityOptions = ['自发性', 'Yes And', '积极聆听', '角色塑造', '情绪表达', '身体空间', '叙事构建', '失败复原', '主持', '团队协作']
const sceneOptions = ['临场速查', '备课', '排练', '演出']

type EditGameDraft = Partial<Material> & {
  people?: string
  duration?: string
  steps?: string
}

type HistoryCard = {
  id: string
  title: string
  desc: string
  meta: string[]
  date: string
}

function buildGameMeta(people = '', duration = '') {
  if (!people && !duration) return []
  return [people || '', duration || '']
}

Page({
  data: {
    themeClass: 'theme-default',
    game: null as Material | null,
    related: null as Material | null,
    saved: false,
    played: false,
    saveIcon: '♡',
    savedText: '♡ 收藏',
    playedText: '○ 练过',
    tagText: '',
    displayMeta: [] as string[],
    layoutStyle: '',
    detailLoading: true,
    detailErrorTitle: '',
    detailErrorDesc: '',
    isCustomGame: false,
    isEditMode: false,
    editGame: {} as EditGameDraft,
    timer: null as number | null,
    currentGameSession: null as any,
    historyCards: [] as HistoryCard[],
    typeCategoryOptions: [] as Array<{ value: string; label: string; activeClass: string }>,
    abilityCategoryOptions: [] as Array<{ value: string; label: string; activeClass: string }>,
    sceneCategoryOptions: [] as Array<{ value: string; label: string; activeClass: string }>,
    customCategoryVisible: false,
    customCategoryInput: '',
    categorySuggestions: [] as Array<{ value: string; label: string }>,
    customCategoryFocus: false,
    showMoreOptions: false,
    moreOptionsToggleText: '补充玩法与提示',
    selectedCategoryTags: [] as string[]
  },

  syncStatusText() {
    this.setData({
      saveIcon: this.data.saved ? '♥︎' : '♡',
      savedText: this.data.saved ? '♥︎ 已收藏' : '♡ 收藏',
      playedText: this.data.played ? '✓ 已练过' : '○ 练过'
    })
  },

  unsubscribeStore: null as null | (() => void),

  async onLoad(options: Record<string, string>) {
    this.setData({
      layoutStyle: getLayoutStyle(),
      themeClass: getThemeClass()
    })
    const id = getRouteParam(options, 'id', '')
    if (!id) {
      this.setData({
        detailLoading: false,
        detailErrorTitle: '没有找到这条素材',
        detailErrorDesc: '返回上一页，重新选择一条素材。'
      })
      return
    }
    
    // 1. 先尝试从本地 store 渲染，避免白屏等待
    let allGames = getState().materials
    let game = allGames.find((item) => item.id === id) || findLocalMaterial(id)
    if (game) {
      this.renderGame(game)
    }

    this.unsubscribeStore = subscribe((state) => {
      const currentGameSession = state.currentMaterial && state.currentMaterial.materialId === id ? state.currentMaterial : null
      const historyCards = state.methodCards
        .filter((card) => game && card.title === game.title)
        .map((card) => ({
          id: card.id,
          title: card.title,
          desc: card.desc,
          meta: card.meta,
          date: new Date(card.createdAt as number).toLocaleDateString()
        }))

      this.setData({ currentGameSession, historyCards })
    })

    // 2. 后台拉取最新数据，确保云端状态同步
    try {
      const serverGames = await listMaterials()
      setMaterials(serverGames)
    } catch (error) {
      if (!this.data.game) {
        this.setData({
          detailLoading: false,
          detailErrorTitle: '素材详情加载失败',
          detailErrorDesc: '云开发暂时没有返回素材数据，可以回到记录页或稍后重试。'
        })
      }
      return
    }

    // 3. 更新为最新数据
    allGames = getState().materials
    game = allGames.find((item) => item.id === id) || findLocalMaterial(id)
    if (game) {
      this.renderGame(game)
    } else {
      this.setData({
        detailLoading: false,
        detailErrorTitle: '没有找到这条素材',
        detailErrorDesc: '这张推荐卡可能已不在当前素材库中，返回记录页重新选择。'
      })
    }
  },

  onShow() {
    this.setData({ themeClass: getThemeClass() })
  },

  onUnload() {
    if (this.data.timer) clearInterval(this.data.timer)
    if (this.unsubscribeStore) this.unsubscribeStore()
  },

  renderGame(game: Material) {
    const allGames = getState().materials
    const related = allGames.find((item) => item.id === game.relatedMaterialId) || findLocalMaterial(game.relatedMaterialId)
    const state = getState()
    const isCustomGame = game.tags.includes('自定义') || game.id.startsWith('custom-')
    const displayMeta = (game.meta || []).filter((item) => typeof item === 'string' && item.trim())
    this.setData({
      game,
      related,
      isCustomGame,
      tagText: [game.type, ...(game.abilities || []), ...(game.tags || [])].filter(Boolean).join(' · '),
      displayMeta,
      saved: state.savedMaterialIds.includes(game.id),
      played: state.playedMaterialIds.includes(game.id),
      detailLoading: false,
      detailErrorTitle: '',
      detailErrorDesc: ''
    }, () => this.syncStatusText())
  },

  retryLoad() {
    if (!this.data.game) {
      this.setData({
        detailLoading: true,
        detailErrorTitle: '',
        detailErrorDesc: ''
      })
      const pages = getCurrentPages()
      const current = pages[pages.length - 1] as { options?: Record<string, string> }
      if (this.unsubscribeStore) {
        this.unsubscribeStore()
        this.unsubscribeStore = null
      }
      this.onLoad(current.options || {})
    }
  },

  back() {
    wx.navigateBack()
  },

  async toggleSaved() {
    if (!this.data.game) return
    const saved = toggleSaved(this.data.game.id)
    this.setData({ saved }, () => this.syncStatusText())
    await updateMaterialState(this.data.game.id, { saved })
  },

  async togglePlayed() {
    if (!this.data.game) return
    const isPlayed = this.data.played
    if (isPlayed) {
      unmarkPlayed(this.data.game.id)
      this.setData({ played: false }, () => this.syncStatusText())
      await updateMaterialState(this.data.game.id, { played: false })
    } else {
      markPlayed(this.data.game.id)
      this.setData({ played: true }, () => this.syncStatusText())
      await updateMaterialState(this.data.game.id, { played: true })
      toast('已标记练过')
    }
  },

  startGame() {
    try {
      const { game } = this.data
      if (!game) return
      if (game.referenceOnly) {
        toast('路径素材只支持查看')
        return
      }
      startMaterialSession({
        id: `session-${Date.now()}`,
        materialId: game.id,
        title: game.title,
        startTime: Date.now(),
        duration: 0,
        status: '进行中'
      })
      this.startTimer()
    } catch (e: any) {
      toast(e.message || '开启失败')
    }
  },

  pauseGame() {
    if (this.data.timer) clearInterval(this.data.timer)
    this.setData({ timer: null })
    updateMaterialSession({ status: '暂停中' })
  },

  resumeGame() {
    updateMaterialSession({ status: '进行中' })
    this.startTimer()
  },

  finishGame() {
    if (this.data.timer) clearInterval(this.data.timer)
    const session = this.data.currentGameSession
    if (!session) return
    clearMaterialSession()
    wx.navigateTo({ url: `/pages/game-feedback/index?id=${session.materialId}&duration=${session.duration}` })
  },

  startTimer() {
    if (this.data.timer) return
    const timer = setInterval(() => {
      const session = this.data.currentGameSession
      if (session) {
        updateMaterialSession({ duration: session.duration + 1 })
      }
    }, 1000) as unknown as number
    this.setData({ timer })
  },

  openRelated() {
    if (!this.data.related) return
    wx.redirectTo({ url: `/pages/game-detail/index?id=${this.data.related.id}` })
  },

  enterEditMode() {
    const game = this.data.game
    if (!game) return
    const editGame: EditGameDraft = { ...game }
    editGame.people = game.meta[0] || ''
    editGame.duration = game.meta[1] || ''
    editGame.steps = (game.steps || []).join('\n')
    
    this.setData({
      editGame,
      selectedCategoryTags: Array.from(new Set([game.type].concat(game.abilities || [], game.scenes || [], game.tags || []).filter(Boolean))),
      showMoreOptions: false,
      moreOptionsToggleText: '补充训练方法',
      isEditMode: true
    })
    this.syncCategoryOptions()
  },

  cancelEdit() {
    this.setData({
      isEditMode: false,
      editGame: {},
      selectedCategoryTags: [],
      customCategoryVisible: false,
      customCategoryFocus: false,
      customCategoryInput: '',
      categorySuggestions: [],
      showMoreOptions: false,
      moreOptionsToggleText: '补充训练方法'
    })
  },

  getCategoryPool() {
    const categories: string[] = []
    defaultCategoryOptions.forEach((item) => categories.push(item))
    getState().materials.forEach((game: Material) => {
      if (Array.isArray(game.tags)) {
        game.tags.forEach((tag) => categories.push(tag))
      }
    })
    return Array.from(new Set(categories.map((item) => String(item).trim()).filter(Boolean)))
  },

  getCategorySuggestions(input: string) {
    const keyword = String(input || '').trim().toLowerCase()
    if (!keyword) return []
    return this.getCategoryPool()
      .filter((item: string) => item.toLowerCase().includes(keyword))
      .slice(0, 5)
      .map((value: string) => ({ value, label: value }))
  },

  syncCategoryOptions() {
    this.setData({
      typeCategoryOptions: materialTypes.map((value: string) => ({
        value,
        label: value,
        activeClass: this.data.selectedCategoryTags.includes(value) ? 'active' : ''
      })),
      abilityCategoryOptions: abilityOptions.map((value: string) => ({
        value,
        label: value,
        activeClass: this.data.selectedCategoryTags.includes(value) ? 'active' : ''
      })),
      sceneCategoryOptions: sceneOptions.map((value: string) => ({
        value,
        label: value,
        activeClass: this.data.selectedCategoryTags.includes(value) ? 'active' : ''
      })),
      categorySuggestions: this.getCategorySuggestions(this.data.customCategoryInput)
    })
  },

  updateEditGame(event: WechatMiniprogram.Input) {
    const field = event.currentTarget.dataset.field
    this.setData({ [`editGame.${field}`]: event.detail.value })
  },

  handleGameFormFieldChange(event: WechatMiniprogram.CustomEvent<{ field: string; value: string }>) {
    const { field, value } = event.detail || { field: '', value: '' }
    if (!field) return
    this.setData({ [`editGame.${field}`]: value })
  },

  setEditMaterialType(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    const value = String(event.detail?.value || '').trim()
    if (!value) return
    const selectedCategoryTags = this.data.selectedCategoryTags
      .filter((item: string) => !materialTypes.includes(item as MaterialType))
      .concat(value)
    this.setData({ selectedCategoryTags }, () => this.syncCategoryOptions())
  },

  toggleEditMaterialAbility(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.toggleEditMaterialCategory(String(event.detail?.value || '').trim())
  },

  toggleEditMaterialScene(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.toggleEditMaterialCategory(String(event.detail?.value || '').trim())
  },

  toggleEditMaterialCategory(category: string) {
    if (!category) return
    const selectedCategoryTags = this.data.selectedCategoryTags.includes(category)
      ? this.data.selectedCategoryTags.filter((item: string) => item !== category)
      : this.data.selectedCategoryTags.concat(category)
    this.setData({ selectedCategoryTags }, () => this.syncCategoryOptions())
  },

  toggleCustomCategory() {
    const customCategoryVisible = !this.data.customCategoryVisible
    if (customCategoryVisible) {
      this.setData({
        customCategoryVisible: true,
        customCategoryFocus: false,
        customCategoryInput: this.data.customCategoryInput,
        categorySuggestions: this.getCategorySuggestions(this.data.customCategoryInput)
      }, () => {
        this.setData({ customCategoryFocus: true })
      })
      return
    }
    this.setData({
      customCategoryVisible: false,
      customCategoryFocus: false,
      customCategoryInput: '',
      categorySuggestions: []
    })
  },

  handleCustomCategoryFocus() {
    if (!this.data.customCategoryFocus) {
      this.setData({ customCategoryFocus: true })
    }
  },

  handleCustomCategoryBlur() {
    if (this.data.customCategoryFocus) {
      this.setData({ customCategoryFocus: false })
    }
  },

  updateCustomCategory(event: WechatMiniprogram.Input) {
    const customCategoryInput = event.detail.value
    this.setData({
      customCategoryInput,
      categorySuggestions: this.getCategorySuggestions(customCategoryInput)
    })
  },

  selectCategorySuggestion(event: WechatMiniprogram.TouchEvent) {
    const category = String((event as WechatMiniprogram.CustomEvent<{ category: string }>).detail?.category || event.currentTarget.dataset.category || '').trim()
    if (!category) return
    this.addCategoryTag(category)
  },

  confirmCustomCategory() {
    const maybeEvent = arguments[0] as WechatMiniprogram.CustomEvent<{ value?: string }> | undefined
    const nextValue = maybeEvent && maybeEvent.detail && typeof maybeEvent.detail.value === 'string'
      ? maybeEvent.detail.value
      : this.data.customCategoryInput
    const category = String(nextValue || '').trim()
    if (!category) {
      toast('先输入分类')
      return
    }
    const existed = this.getCategoryPool().find((item: string) => item.toLowerCase() === category.toLowerCase())
    this.addCategoryTag(existed || category)
  },

  addCategoryTag(category: string) {
    const selectedCategoryTags = this.data.selectedCategoryTags.includes(category)
      ? this.data.selectedCategoryTags
      : this.data.selectedCategoryTags.concat(category)
    this.setData({
      selectedCategoryTags,
      customCategoryVisible: false,
      customCategoryFocus: false,
      customCategoryInput: '',
      categorySuggestions: []
    }, () => this.syncCategoryOptions())
  },

  toggleMoreOptions() {
    const nextVisible = !this.data.showMoreOptions
    this.setData({
      showMoreOptions: nextVisible,
      moreOptionsToggleText: nextVisible ? '收起训练方法' : '补充训练方法'
    })
  },

  async saveGame() {
    const title = this.data.editGame.title
    if (!title) {
      toast('先写素材名称')
      return
    }
    const tags: string[] = Array.from(new Set(this.data.selectedCategoryTags.map((item: string) => item.trim()).filter(Boolean)))
    if (!tags.length) tags.push('自定义')

    const currentGame = { ...(this.data.game as Material & { fit?: string[]; lead?: string; avoid?: string; verdict?: string }) }
    delete currentGame.fit
    delete currentGame.lead
    delete currentGame.avoid
    delete currentGame.verdict

    const materialType = (materialTypes.find((item) => tags.includes(item)) || currentGame.type || '游戏') as MaterialType
    const abilities = abilityOptions.filter((item) => tags.includes(item))
    const scenes = sceneOptions.filter((item) => tags.includes(item))
    const steps = typeof this.data.editGame.steps === 'string' && this.data.editGame.steps.trim()
      ? this.data.editGame.steps.split('\n').map((item: string) => item.trim()).filter(Boolean)
      : []

    const updatedGame: Material = {
      ...currentGame,
      title,
      desc: this.data.editGame.desc || '',
      tags,
      type: materialType,
      abilities,
      scenes,
      meta: buildGameMeta(this.data.editGame.people, this.data.editGame.duration),
      steps,
      tips: this.data.editGame.tips || '',
      variant: this.data.editGame.variant || '',
      issue: this.data.editGame.issue || '',
      relatedMaterialId: currentGame.relatedMaterialId || '',
      referenceOnly: currentGame.referenceOnly || false
    }

    const allGames = getState().materials
    const index = allGames.findIndex((gameItem: Material) => gameItem.id === updatedGame.id)
    if (index > -1) {
      allGames[index] = updatedGame
      setMaterials([...allGames])
    }

    this.renderGame(updatedGame)
    this.cancelEdit()
    await updateMaterial(updatedGame)
    toast('已保存修改')
  },

  confirmDelete() {
    wx.showModal({
      title: '确认删除',
      content: '删除后无法恢复，是否继续？',
      success: async (res) => {
        if (res.confirm) {
          const materialId = this.data.game?.id
          if (!materialId) return
          
          const allGames = getState().materials
          setMaterials(allGames.filter((gameItem: Material) => gameItem.id !== materialId))
          
          wx.navigateBack()
          setTimeout(() => {
            toast('已删除')
          }, 300)
          await deleteMaterial(materialId)
        }
      }
    })
  }
})
