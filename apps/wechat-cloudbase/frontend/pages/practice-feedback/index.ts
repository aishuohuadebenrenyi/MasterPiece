import type { Material, TodayItem, PracticeRecord, PracticeRecordAttachment } from '../../types/domain'
import { findLocalMaterial } from '../../services/material'
import { completePractice } from '../../services/practice-record'
import { listRehearsals } from '../../services/rehearsal'
import {
  addMethodCard,
  addPracticeRecord,
  getState,
  markPlayed,
  updateCurrentRehearsalPlan,
  getThemeClass
} from '../../store/index'
import { getRouteParam, toast } from '../../utils/page'
import { getLayoutStyle } from '../../utils/layout'

type AttachmentMode = '' | 'upload-media' | 'take-photo' | 'take-video' | 'record-audio'

function buildAttachmentModeCopy(mode: AttachmentMode) {
  const map: Record<string, { title: string; desc: string }> = {
    'upload-media': {
      title: '上传照片或视频',
      desc: '保存到这次练习。'
    },
    'take-photo': {
      title: '拍照片',
      desc: '保存前可删除。'
    },
    'take-video': {
      title: '拍视频',
      desc: '可在素材记录页回看。'
    },
    'record-audio': {
      title: '录音',
      desc: '保存到这次练习。'
    }
  }
  return map[mode] || { title: '', desc: '' }
}

function formatAudioDuration(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(Number(seconds) || 0))
  const min = Math.floor(safeSeconds / 60)
  const sec = safeSeconds % 60
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

Page({
  data: {
    themeClass: 'theme-default',
    material: null as Material | null,
    linkedRehearsal: '',
    contextType: 'single',
    historicalRehearsals: [] as Array<{ id: string; title: string }>,
    selectedHistoricalRehearsalId: '',
    contextLoading: false,
    contextLoadFailed: false,
    contextSummaryTitle: '',
    contextSummaryDesc: '',
    attendanceText: '',
    scoreValue: 8,
    noteValue: '',
    reminderValue: '',
    draftAttachments: [] as PracticeRecordAttachment[],
    uploadingAttachment: false,
    activeAttachmentAction: '',
    audioRecording: false,
    audioUploading: false,
    audioDurationText: '00:00',
    attachmentMode: '' as AttachmentMode,
    attachmentModeTitle: '',
    attachmentModeDesc: '',
    moreVisible: false,
    savingMode: '' as '' | 'record' | 'method',
    contextOptions: [] as Array<{ value: string; label: string; activeClass: string }>,
    layoutStyle: '',
    duration: 0,
    durationText: ''
  },

  recorderManager: null as any,
  audioRecordingStartedAt: 0,

  onShareAppMessage() {
    const material = this.data.material
    if (material) {
      const stripeMap: Record<string, string> = {
        orange: '/assets/share/share-material-orange.png',
        blue: '/assets/share/share-material-blue.png',
        mint: '/assets/share/share-material-mint.png'
      }
      return {
        title: `【${material.type}】${material.title} — 练习复盘`,
        path: `/pages/material-detail/index?id=${material.id}`,
        imageUrl: stripeMap[material.stripeTone] || '/assets/share/share-brand.png'
      }
    }
    return {
      title: '练习复盘 — 即兴工具箱',
      path: '/pages/discover/index',
      imageUrl: '/assets/share/share-brand.png'
    }
  },

  syncContextSummary() {
    const linkedRehearsal = this.data.linkedRehearsal || '单独记录'
    const summaryMap: Record<string, { title: string; desc: string }> = {
      single: {
        title: '单独记录',
        desc: '只保存这条反馈，不写入排练。'
      },
      current: {
        title: '加入当前排练',
        desc: `保存时会回写到「${linkedRehearsal}」的计划里。`
      },
      history: {
        title: '关联历史排练',
        desc: `只保存与「${linkedRehearsal}」的关联，不修改历史排练。`
      },
    }
    const nextSummary = summaryMap[this.data.contextType] || summaryMap.single
    this.setData({
      contextSummaryTitle: nextSummary.title,
      contextSummaryDesc: nextSummary.desc
    })
  },

  syncOptions() {
    const currentRehearsal = getState().currentRehearsal
    const hasHistorical = this.data.historicalRehearsals.length > 0
    this.setData({
      contextOptions: [
        { value: 'single', label: '单独记录' },
        ...(currentRehearsal ? [{ value: 'current', label: '加入当前排练' }] : []),
        ...(hasHistorical ? [{ value: 'history', label: '关联历史排练' }] : [])
      ].map((item) => Object.assign({}, item, {
        activeClass: this.data.contextType === item.value ? 'active' : ''
      }))
    })
  },

  onLoad(options: Record<string, string>) {
    this.setData({
      layoutStyle: getLayoutStyle(),
      themeClass: getThemeClass()
    })
    const id = getRouteParam(options, 'id', '')
    const duration = parseInt(getRouteParam(options, 'duration', '0'), 10)
    const attachmentMode = getRouteParam(options, 'attachmentMode', '') as AttachmentMode
    const attachmentModeCopy = buildAttachmentModeCopy(attachmentMode)

    if (!id) {
      toast('未找到素材')
      setTimeout(() => this.back(), 1500)
      return
    }

    const state = getState()
    const material = state.materials.find((item) => item.id === id) || findLocalMaterial(id)
    if (!material) {
      toast('素材不存在')
      setTimeout(() => this.back(), 1500)
      return
    }

    const currentRehearsal = state.currentRehearsal
    const historicalRehearsals = (state.rehearsalHistory || [])
      .filter((item) => !currentRehearsal || item.id !== currentRehearsal.id)
      .map((item) => ({ id: item.id, title: item.title }))

    let durationText = ''
    if (duration > 0) {
      const m = Math.floor(duration / 60)
      const s = duration % 60
      durationText = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    }

    this.setData({
      material,
      duration,
      durationText,
      attachmentMode,
      attachmentModeTitle: attachmentModeCopy.title,
      attachmentModeDesc: attachmentModeCopy.desc,
      linkedRehearsal: currentRehearsal ? currentRehearsal.title : '单独记录',
      contextType: currentRehearsal ? 'current' : 'single',
      historicalRehearsals,
      selectedHistoricalRehearsalId: historicalRehearsals[0] ? historicalRehearsals[0].id : ''
    }, () => {
      this.syncContextSummary()
    })
    this.syncOptions()
    this.loadHistoricalRehearsals()
  },

  onUnload() {
    if (this.data.audioRecording && this.recorderManager && typeof this.recorderManager.stop === 'function') {
      this.recorderManager.stop()
    }
  },

  async loadHistoricalRehearsals() {
    if (this.data.contextLoading) return
    const state = getState()
    const currentRehearsal = state.currentRehearsal
    const localRehearsals = state.rehearsalHistory || []
    this.setData({ contextLoading: true, contextLoadFailed: false })
    try {
      const remoteRehearsals = await listRehearsals({ limit: 100 }, { silent: true })
      const merged = localRehearsals.concat(remoteRehearsals).reduce((map, item) => {
        if (item && item.id && !map.has(item.id)) map.set(item.id, item)
        return map
      }, new Map<string, { id: string; title: string }>())
      const historicalRehearsals = Array.from(merged.values())
        .filter((item) => !currentRehearsal || item.id !== currentRehearsal.id)
        .map((item) => ({ id: item.id, title: item.title }))
      const selectedStillExists = historicalRehearsals.some((item) => item.id === this.data.selectedHistoricalRehearsalId)
      const selectedHistoricalRehearsalId = selectedStillExists
        ? this.data.selectedHistoricalRehearsalId
        : (historicalRehearsals[0] ? historicalRehearsals[0].id : '')
      const selected = historicalRehearsals.find((item) => item.id === selectedHistoricalRehearsalId)
      const historyUnavailable = this.data.contextType === 'history' && !selected
      this.setData({
        historicalRehearsals,
        selectedHistoricalRehearsalId,
        contextType: historyUnavailable ? 'single' : this.data.contextType,
        linkedRehearsal: historyUnavailable ? '单独记录' : (this.data.contextType === 'history' && selected ? selected.title : this.data.linkedRehearsal),
        contextLoading: false,
        contextLoadFailed: false
      }, () => {
        this.syncOptions()
        this.syncContextSummary()
      })
    } catch (error) {
      this.setData({ contextLoading: false, contextLoadFailed: true }, () => this.syncOptions())
    }
  },

  retryHistoricalRehearsals() {
    this.loadHistoricalRehearsals()
  },

  onShow() {
    const currentRehearsal = getState().currentRehearsal
    const historical = this.data.historicalRehearsals.find((item) => item.id === this.data.selectedHistoricalRehearsalId)
    this.setData({
      themeClass: getThemeClass(),
      linkedRehearsal: this.data.contextType === 'single'
        ? '单独记录'
        : this.data.contextType === 'history'
          ? (historical ? historical.title : '历史排练')
          : (currentRehearsal ? currentRehearsal.title : '当前排练')
    }, () => {
      this.syncOptions()
      this.syncContextSummary()
    })
  },

  back() {
    wx.navigateBack()
  },

  buildFeedbackSummary() {
    return `评分: ${this.data.scoreValue}/10\n本次复盘: ${this.data.noteValue || '无'}${this.data.reminderValue ? '\n提醒: ' + this.data.reminderValue : ''}`
  },

  buildMethodCardItem(): TodayItem | null {
    if (!this.data.material) return null
    return {
      id: `method-${Date.now()}`,
      type: '素材练习',
      title: `${this.data.material.title}的复盘`,
      desc: this.buildFeedbackSummary()
    }
  },

  setContextType(event: WechatMiniprogram.TouchEvent) {
    const value = event.currentTarget.dataset.value as string
    const current = getState().currentRehearsal
    const nextType = value === 'current' && !current ? 'single' : value
    const historical = this.data.historicalRehearsals.find((item) => item.id === this.data.selectedHistoricalRehearsalId)
    this.setData({
      contextType: nextType,
      linkedRehearsal: nextType === 'single'
        ? '单独记录'
        : nextType === 'history'
          ? (historical ? historical.title : '历史排练')
          : (current ? current.title : '当前排练')
    }, () => {
      this.syncOptions()
      this.syncContextSummary()
    })
  },

  selectHistoricalRehearsal(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    const index = Number(event.detail.value)
    const selected = this.data.historicalRehearsals[index]
    if (!selected) return
    this.setData({
      selectedHistoricalRehearsalId: selected.id,
      linkedRehearsal: selected.title
    }, () => this.syncContextSummary())
  },

  setScoreValue(value: number) {
    const scoreValue = Math.max(1, Math.min(10, Math.round(Number(value) || 8)))
    this.setData({ scoreValue })
  },

  setScore(event: WechatMiniprogram.CustomEvent<{ value: number }>) {
    this.setScoreValue(Number(event.detail.value))
  },

  adjustScore(event: WechatMiniprogram.TouchEvent) {
    const delta = Number(event.currentTarget.dataset.delta) || 0
    this.setScoreValue(this.data.scoreValue + delta)
  },

  toggleMore() {
    this.setData({ moreVisible: !this.data.moreVisible })
  },

  updateField(event: WechatMiniprogram.Input) {
    const field = event.currentTarget.dataset.field
    this.setData({ [field]: event.detail.value })
  },

  getUploadExtension(path = '', mediaType = 'image') {
    const match = path.match(/\.([a-zA-Z0-9]+)(?:\?|$)/)
    if (match && match[1]) return match[1].toLowerCase()
    if (mediaType === 'audio') return 'mp3'
    return mediaType === 'video' ? 'mp4' : 'jpg'
  },

  async addAttachment(event: WechatMiniprogram.TouchEvent) {
    if (this.data.uploadingAttachment) return
    const action = String(event.currentTarget.dataset.action || '')
    const requestedType = event.currentTarget.dataset.type || 'image'
    const requestedSource = event.currentTarget.dataset.source || 'all'
    const mediaTypes = requestedType === 'mixed' ? ['image', 'video'] : [requestedType === 'video' ? 'video' : 'image']
    const sourceTypes = requestedSource === 'album'
      ? ['album']
      : requestedSource === 'camera'
        ? ['camera']
        : ['album', 'camera']
    const currentAttachments = this.data.draftAttachments || []
    if (currentAttachments.length >= 9) {
      toast('最多添加 9 个附件')
      return
    }
    this.setData({ uploadingAttachment: true, activeAttachmentAction: action })
    try {
      const picked = await (wx as any).chooseMedia({
        count: 1,
        mediaType: mediaTypes,
        sourceType: sourceTypes,
        sizeType: ['compressed']
      })
      const file = picked.tempFiles && picked.tempFiles[0]
      if (!file || !file.tempFilePath) {
        this.setData({ uploadingAttachment: false, activeAttachmentAction: '' })
        return
      }
      const id = `attachment-${Date.now()}`
      const mediaType = file.fileType === 'video' || requestedType === 'video' ? 'video' : 'image'
      const extension = this.getUploadExtension(file.tempFilePath, mediaType)
      const cloudPath = `practice-attachments/${mediaType}/${id}.${extension}`
      const uploaded = await (wx.cloud as any).uploadFile({
        cloudPath,
        filePath: file.tempFilePath
      })
      const nextAttachment: PracticeRecordAttachment = {
        id,
        type: mediaType as 'image' | 'video',
        fileID: uploaded.fileID,
        duration: typeof file.duration === 'number' ? file.duration : undefined,
        size: typeof file.size === 'number' ? file.size : undefined,
        createdAt: Date.now()
      }
      this.setData({
        draftAttachments: currentAttachments.concat(nextAttachment),
        uploadingAttachment: false,
        activeAttachmentAction: ''
      })
    } catch (error: any) {
      this.setData({ uploadingAttachment: false, activeAttachmentAction: '' })
      if (error && /cancel/i.test(String(error.errMsg || error.message || ''))) return
      toast('附件添加失败')
    }
  },

  ensureRecorderManager() {
    if (this.recorderManager) return this.recorderManager
    const recorderManager = (wx as any).getRecorderManager ? (wx as any).getRecorderManager() : null
    if (!recorderManager) return null
    recorderManager.onStop((result: any) => this.handleAudioStop(result))
    recorderManager.onError(() => {
      this.setData({ audioRecording: false, audioUploading: false })
      toast('录音权限不可用，请在系统设置中开启麦克风权限')
    })
    this.recorderManager = recorderManager
    return recorderManager
  },

  startAudioRecording() {
    if (this.data.audioRecording || this.data.audioUploading) return
    const currentAttachments = this.data.draftAttachments || []
    if (currentAttachments.length >= 9) {
      toast('最多添加 9 个附件')
      return
    }
    const recorderManager = this.ensureRecorderManager()
    if (!recorderManager) {
      toast('当前环境不支持录音')
      return
    }
    try {
      this.audioRecordingStartedAt = Date.now()
      this.setData({ audioRecording: true, audioDurationText: '00:00' })
      recorderManager.start({
        duration: 600000,
        sampleRate: 16000,
        numberOfChannels: 1,
        encodeBitRate: 48000,
        format: 'mp3'
      })
    } catch (error) {
      this.setData({ audioRecording: false })
      toast('录音启动失败')
    }
  },

  stopAudioRecording() {
    if (!this.data.audioRecording || !this.recorderManager) return
    this.recorderManager.stop()
  },

  async handleAudioStop(result: any) {
    const tempFilePath = result && result.tempFilePath
    const durationSeconds = Math.max(0, Math.round(((Date.now() - this.audioRecordingStartedAt) || 0) / 1000))
    this.setData({
      audioRecording: false,
      audioUploading: true,
      audioDurationText: formatAudioDuration(durationSeconds)
    })
    if (!tempFilePath) {
      this.setData({ audioUploading: false })
      return
    }
    try {
      const id = `attachment-${Date.now()}`
      const extension = this.getUploadExtension(tempFilePath, 'audio') || 'mp3'
      const uploaded = await (wx.cloud as any).uploadFile({
        cloudPath: `practice-attachments/audio/${id}.${extension}`,
        filePath: tempFilePath
      })
      const nextAttachment: PracticeRecordAttachment = {
        id,
        type: 'audio',
        fileID: uploaded.fileID,
        duration: durationSeconds,
        size: typeof result.fileSize === 'number' ? result.fileSize : undefined,
        createdAt: Date.now()
      }
      this.setData({
        draftAttachments: (this.data.draftAttachments || []).concat(nextAttachment),
        audioUploading: false
      })
      toast('录音已添加')
    } catch (error) {
      this.setData({ audioUploading: false })
      toast('录音上传失败')
    }
  },

  removeDraftAttachment(event: WechatMiniprogram.TouchEvent) {
    const id = event.currentTarget.dataset.id
    this.setData({
      draftAttachments: (this.data.draftAttachments || []).filter((item) => item.id !== id)
    })
  },

  async persistFeedbackRecord(options: { createMethodCard: boolean }) {
    if (!this.data.material || this.data.savingMode) return
    this.setData({ savingMode: options.createMethodCard ? 'method' : 'record' })
    const material = this.data.material
    const targetRehearsal = this.data.contextType === 'current'
      ? getState().currentRehearsal
      : this.data.contextType === 'history'
        ? this.data.historicalRehearsals.find((item) => item.id === this.data.selectedHistoricalRehearsalId) || null
        : null
    const practiceRecord: PracticeRecord = {
      id: `practiceRecord-${Date.now()}`,
      title: material.title,
      desc: this.data.noteValue || this.data.reminderValue || '无反馈',
      materialId: material.id,
      materialTitle: material.title,
      rehearsalId: targetRehearsal ? targetRehearsal.id : '',
      rehearsalTitle: targetRehearsal ? targetRehearsal.title : '',
      score: this.data.scoreValue,
      note: this.data.noteValue,
      attachments: this.data.draftAttachments,
      reminder: this.data.reminderValue,
      duration: this.data.duration,
      meta: [`${this.data.scoreValue} 分`, this.data.attendanceText].filter(Boolean),
      createdAt: Date.now()
    }
    const methodCard = options.createMethodCard ? this.buildMethodCardItem() : null

    try {
      const result = await completePractice({
        practiceRecord: {
          id: practiceRecord.id,
          materialId: practiceRecord.materialId,
          materialTitle: practiceRecord.materialTitle,
          rehearsalId: practiceRecord.rehearsalId,
          rehearsalTitle: practiceRecord.rehearsalTitle,
          title: practiceRecord.title,
          desc: practiceRecord.desc,
          score: practiceRecord.score,
          note: practiceRecord.note,
          attachments: practiceRecord.attachments,
          reminder: practiceRecord.reminder,
          duration: practiceRecord.duration,
          meta: practiceRecord.meta
        },
        rehearsalPatch: targetRehearsal && this.data.contextType === 'current' ? {
          rehearsalId: targetRehearsal.id,
          materialId: material.id,
          status: '已完成',
          keep: this.data.noteValue,
          try: ''
        } : null,
        methodCard: methodCard ? {
          id: methodCard.id,
          sourceType: 'practiceRecord',
          sourceId: practiceRecord.id,
          sourceTitle: practiceRecord.title,
          type: '素材练习',
          title: methodCard.title,
          desc: methodCard.desc,
          meta: ['素材练习', material.title, `${this.data.scoreValue} 分`]
        } : null
      })
      addPracticeRecord(result.practiceRecord)
      if (targetRehearsal && this.data.contextType === 'current') {
        updateCurrentRehearsalPlan(material.id, {
          status: '已完成',
          keep: this.data.noteValue,
          try: ''
        })
      }
      markPlayed(material.id)
      if (methodCard && result.methodCard) addMethodCard(result.methodCard as TodayItem)
      toast(options.createMethodCard ? '已保存并沉淀为方法卡' : '已保存练习记录')
      setTimeout(() => {
        wx.switchTab({ url: '/pages/discover/index' })
      }, 1500)
    } catch (error: any) {
      toast(error.message || '保存失败，请重试')
    } finally {
      this.setData({ savingMode: '' })
    }
  },

  async saveRecord() {
    await this.persistFeedbackRecord({ createMethodCard: false })
  },

  async saveMethodCard() {
    await this.persistFeedbackRecord({ createMethodCard: true })
  }
})
