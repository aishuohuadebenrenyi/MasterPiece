import type { Material, MaterialType } from '../../types/domain'
import { findLocalMaterial, listMaterials, updateMaterialState, updateMaterial, deleteMaterial } from '../../services/material'
import { getState, markPlayed, unmarkPlayed, setMaterials, toggleSaved, startMaterialSession, subscribe, updateMaterialSession, clearMaterialSession , getThemeClass } from '../../store/index'
import { getRouteParam, toast } from '../../utils/page'
import { getLayoutStyle } from '../../utils/layout'
import { SHARE_ABILITY_COUNT, CATEGORY_SUGGESTION_LIMIT } from '../../config/constants'

const materialTypes: MaterialType[] = ['游戏', '角色', '才艺', '格式', '主理', '技巧', '复盘', '路径']
const defaultCategoryOptions = ['游戏', '角色', '才艺', '格式', '主理', '技巧', '复盘', '路径']
const abilityOptions = ['自发性', 'Yes And', '积极聆听', '角色塑造', '情绪表达', '身体空间', '叙事构建', '失败复原', '主持', '团队协作']
const sceneOptions = ['临场速查', '备课', '排练', '演出']

type EditMaterialDraft = Partial<Material> & {
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

function buildMaterialMeta(people = '', duration = '') {
  if (!people && !duration) return []
  return [people || '', duration || '']
}

function isEditableMaterial(material: Material) {
  return material.ownerOpenId !== 'system' && (Boolean(material.ownerOpenId) || material.tags.includes('自定义') || material.id.startsWith('custom-'))
}

function isPermissionError(message = '') {
  return message.includes('权限') || message.includes('无权限')
}

Page({
  data: {
    themeClass: 'theme-default',
    material: null as Material | null,
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
    canEditMaterial: false,
    isEditMode: false,
    editMaterial: {} as EditMaterialDraft,
    timer: null as number | null,
    currentMaterialSession: null as any,
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

  onShareAppMessage() {
    const material = this.data.material
    if (material) {
      const stripeMap: Record<string, string> = {
        orange: '/assets/share/share-material-orange.png',
        blue: '/assets/share/share-material-blue.png',
        mint: '/assets/share/share-material-mint.png'
      }
      const abilities = (material.abilities || []).slice(0, SHARE_ABILITY_COUNT).join('·')
      return {
        title: `【${material.type}】${material.title}${abilities ? ' — ' + abilities : ''}`,
        path: `/pages/material-detail/index?id=${material.id}`,
        imageUrl: stripeMap[material.stripeTone] || '/assets/share/share-brand.png'
      }
    }
    return {
      title: '即兴素材 — 即兴工具箱',
      path: '/pages/discover/index',
      imageUrl: '/assets/share/share-brand.png'
    }
  },

  onShareTimeline() {
    const material = this.data.material
    if (material) {
      const stripeMap: Record<string, string> = {
        orange: '/assets/share/share-material-orange.png',
        blue: '/assets/share/share-material-blue.png',
        mint: '/assets/share/share-material-mint.png'
      }
      return {
        title: `【${material.type}】${material.title}`,
        query: `id=${material.id}`,
        imageUrl: stripeMap[material.stripeTone] || '/assets/share/share-brand.png'
      }
    }
    return {
      title: '即兴素材 — 即兴工具箱',
      query: '',
      imageUrl: '/assets/share/share-brand.png'
    }
  },

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
    let allMaterials = getState().materials
    let material = allMaterials.find((item) => item.id === id) || findLocalMaterial(id)
    if (material) {
      this.renderMaterial(material)
    }

    this.unsubscribeStore = subscribe((state) => {
      const currentMaterialSession = state.currentMaterial && state.currentMaterial.materialId === id ? state.currentMaterial : null
      const historyCards = state.methodCards
        .filter((card) => material && card.title === material.title)
        .map((card) => ({
          id: card.id,
          title: card.title,
          desc: card.desc,
          meta: card.meta,
          date: new Date(card.createdAt as number).toLocaleDateString()
        }))

      this.setData({ currentMaterialSession, historyCards })
    })

    // 2. 后台拉取最新数据，确保云端状态同步
    try {
      const serverMaterials = await listMaterials()
      setMaterials(serverMaterials)
    } catch (error) {
      if (!this.data.material) {
        this.setData({
          detailLoading: false,
          detailErrorTitle: '素材详情加载失败',
          detailErrorDesc: '云开发暂时没有返回素材数据，可以回到记录页或稍后重试。'
        })
      }
      return
    }

    // 3. 更新为最新数据
    allMaterials = getState().materials
    material = allMaterials.find((item) => item.id === id) || findLocalMaterial(id)
    if (material) {
      this.renderMaterial(material)
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

  renderMaterial(material: Material) {
    const allMaterials = getState().materials
    const related = allMaterials.find((item) => item.id === material.relatedMaterialId) || findLocalMaterial(material.relatedMaterialId)
    const state = getState()
    const canEditMaterial = isEditableMaterial(material)
    const displayMeta = (material.meta || []).filter((item) => typeof item === 'string' && item.trim())
    this.setData({
      material,
      related,
      canEditMaterial,
      tagText: [material.type, ...(material.abilities || []), ...(material.tags || [])].filter(Boolean).join(' · '),
      displayMeta,
      saved: state.savedMaterialIds.includes(material.id),
      played: state.playedMaterialIds.includes(material.id),
      detailLoading: false,
      detailErrorTitle: '',
      detailErrorDesc: ''
    }, () => this.syncStatusText())
  },

  retryLoad() {
    if (!this.data.material) {
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
    if (!this.data.material) return
    const saved = toggleSaved(this.data.material.id)
    this.setData({ saved }, () => this.syncStatusText())
    await updateMaterialState(this.data.material.id, { saved })
  },

  async togglePlayed() {
    if (!this.data.material) return
    const isPlayed = this.data.played
    if (isPlayed) {
      unmarkPlayed(this.data.material.id)
      this.setData({ played: false }, () => this.syncStatusText())
      await updateMaterialState(this.data.material.id, { played: false })
    } else {
      markPlayed(this.data.material.id)
      this.setData({ played: true }, () => this.syncStatusText())
      await updateMaterialState(this.data.material.id, { played: true })
      toast('已标记练过')
    }
  },

  startPractice() {
    try {
      const { material } = this.data
      if (!material) return
      if (material.referenceOnly) {
        toast('路径素材只支持查看')
        return
      }
      startMaterialSession({
        id: `session-${Date.now()}`,
        materialId: material.id,
        title: material.title,
        startTime: Date.now(),
        duration: 0,
        status: '进行中'
      })
      this.startTimer()
    } catch (e: any) {
      toast(e.message || '开启失败')
    }
  },

  pausePractice() {
    if (this.data.timer) clearInterval(this.data.timer)
    this.setData({ timer: null })
    updateMaterialSession({ status: '暂停中' })
  },

  resumePractice() {
    updateMaterialSession({ status: '进行中' })
    this.startTimer()
  },

  finishPractice() {
    if (this.data.timer) clearInterval(this.data.timer)
    const session = this.data.currentMaterialSession
    if (!session) return
    clearMaterialSession()
    wx.navigateTo({ url: `/pages/practice-feedback/index?id=${session.materialId}&duration=${session.duration}` })
  },

  startTimer() {
    if (this.data.timer) return
    const timer = setInterval(() => {
      const session = this.data.currentMaterialSession
      if (session) {
        updateMaterialSession({ duration: session.duration + 1 })
      }
    }, 1000) as unknown as number
    this.setData({ timer })
  },

  openRelated() {
    if (!this.data.related) return
    wx.redirectTo({ url: `/pages/material-detail/index?id=${this.data.related.id}` })
  },

  enterEditMode() {
    const material = this.data.material
    if (!material) return
    if (!this.data.canEditMaterial) {
      toast('只能修改自己创建的素材')
      return
    }
    const editMaterial: EditMaterialDraft = { ...material }
    editMaterial.people = material.meta[0] || ''
    editMaterial.duration = material.meta[1] || ''
    editMaterial.steps = (material.steps || []).join('\n')
    
    this.setData({
      editMaterial,
      selectedCategoryTags: Array.from(new Set([material.type].concat(material.abilities || [], material.scenes || [], material.tags || []).filter(Boolean))),
      showMoreOptions: false,
      moreOptionsToggleText: '补充训练方法',
      isEditMode: true
    })
    this.syncCategoryOptions()
  },

  cancelEdit() {
    this.setData({
      isEditMode: false,
      editMaterial: {},
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
    getState().materials.forEach((material: Material) => {
      if (Array.isArray(material.tags)) {
        material.tags.forEach((tag) => categories.push(tag))
      }
    })
    return Array.from(new Set(categories.map((item) => String(item).trim()).filter(Boolean)))
  },

  getCategorySuggestions(input: string) {
    const keyword = String(input || '').trim().toLowerCase()
    if (!keyword) return []
    return this.getCategoryPool()
      .filter((item: string) => item.toLowerCase().includes(keyword))
      .slice(0, CATEGORY_SUGGESTION_LIMIT)
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

  updateEditMaterial(event: WechatMiniprogram.Input) {
    const field = event.currentTarget.dataset.field
    this.setData({ [`editMaterial.${field}`]: event.detail.value })
  },

  handleMaterialFormFieldChange(event: WechatMiniprogram.CustomEvent<{ field: string; value: string }>) {
    const { field, value } = event.detail || { field: '', value: '' }
    if (!field) return
    this.setData({ [`editMaterial.${field}`]: value })
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

  async saveMaterial() {
    const title = this.data.editMaterial.title
    if (!title) {
      toast('先写素材名称')
      return
    }
    if (!this.data.material || !this.data.canEditMaterial) {
      toast('只能修改自己创建的素材')
      return
    }
    const tags: string[] = Array.from(new Set(this.data.selectedCategoryTags.map((item: string) => item.trim()).filter(Boolean)))
    if (!tags.length) tags.push('自定义')

    const currentMaterial = { ...(this.data.material as Material & { fit?: string[]; lead?: string; avoid?: string; verdict?: string; ownerOpenId?: string }) }
    delete currentMaterial.fit
    delete currentMaterial.lead
    delete currentMaterial.avoid
    delete currentMaterial.verdict

    const materialType = (materialTypes.find((item) => tags.includes(item)) || currentMaterial.type || '游戏') as MaterialType
    const abilities = abilityOptions.filter((item) => tags.includes(item))
    const scenes = sceneOptions.filter((item) => tags.includes(item))
    const steps = typeof this.data.editMaterial.steps === 'string' && this.data.editMaterial.steps.trim()
      ? this.data.editMaterial.steps.split('\n').map((item: string) => item.trim()).filter(Boolean)
      : []

    const updatedMaterial: Material = {
      ...currentMaterial,
      title,
      desc: this.data.editMaterial.desc || '',
      tags,
      type: materialType,
      abilities,
      scenes,
      meta: buildMaterialMeta(this.data.editMaterial.people, this.data.editMaterial.duration),
      steps,
      tips: this.data.editMaterial.tips || '',
      variant: this.data.editMaterial.variant || '',
      issue: this.data.editMaterial.issue || '',
      relatedMaterialId: currentMaterial.relatedMaterialId || '',
      referenceOnly: materialType === '路径' ? true : currentMaterial.referenceOnly || false
    }

    const updatePayload = { ...updatedMaterial }
    delete updatePayload.ownerOpenId
    const response = await updateMaterial(updatePayload)
    if (response.code !== 0) {
      if (isPermissionError(response.message)) {
        toast('只能修改自己创建的素材')
        this.refreshMaterials(updatedMaterial.id)
        return
      }
      toast('保存失败，请稍后重试')
      return
    }

    const allMaterials = getState().materials
    const nextMaterials = allMaterials.map((materialItem: Material) => materialItem.id === updatedMaterial.id ? Object.assign({}, materialItem, updatedMaterial) : materialItem)
    setMaterials(nextMaterials)
    this.renderMaterial(updatedMaterial)
    this.cancelEdit()
    toast('已保存修改')
  },

  async refreshMaterials(materialId?: string) {
    try {
      const serverMaterials = await listMaterials()
      setMaterials(serverMaterials)
      const currentId = materialId || this.data.material?.id
      const material = currentId ? serverMaterials.find((item: Material) => item.id === currentId) || null : null
      if (material) {
        this.renderMaterial(material)
      }
    } catch (error) {
      // 原操作已告知用户失败原因，刷新只做尽力而为
    }
  },

  confirmDelete() {
    if (!this.data.material || !this.data.canEditMaterial) {
      toast('只能删除自己创建的素材')
      return
    }
    wx.showModal({
      title: '确认删除',
      content: '删除后会从你的素材库移除，是否继续？',
      success: async (res) => {
        if (res.confirm) {
          const materialId = this.data.material?.id
          if (!materialId) return

          const response = await deleteMaterial(materialId)
          if (response.code !== 0) {
            if (isPermissionError(response.message)) {
              toast('只能删除自己创建的素材')
              this.refreshMaterials(materialId)
              return
            }
            toast('删除失败，请稍后重试')
            return
          }

          const allMaterials = getState().materials
          setMaterials(allMaterials.filter((materialItem: Material) => materialItem.id !== materialId))
          wx.navigateBack()
          setTimeout(() => {
            toast('已删除')
          }, 300)
        }
      }
    })
  }
})
